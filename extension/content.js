/*
 * Content script cho https://redeem.df.garena.sg/* (isolated world).
 *
 * Lặp qua danh sách code: điền code vào ô nhập → bấm nút "Đổi" → chờ kết quả →
 * đóng hộp thoại → chờ N giây → code tiếp theo. Chỉ thao tác trên giao diện của
 * trang giống hệt người dùng: không tự gọi API, không đọc cookie, không gửi dữ liệu
 * đi đâu. Tiến trình lưu trong chrome.storage.local nên đóng popup vẫn chạy tiếp.
 */
(() => {
  'use strict';

  if (globalThis.__dfrContentLoaded) return;
  globalThis.__dfrContentLoaded = true;

  const {
    JOB_KEY,
    HOOK_EVENT,
    HOOK_PING_EVENT,
    MAX_ATTEMPTS,
    MAX_NETWORK_STREAK,
    MAX_UNKNOWN_STREAK,
    RESULT_TIMEOUT_MS,
    SEND_TIMEOUT_MS,
    PAGE_LOCK_MS,
    MAX_HISTORY,
    clampDelay,
    describeApiResult,
    describePageMessage,
    pushLog,
    summarize,
    formatSeconds,
  } = globalThis.DFR;

  const HISTORY_KEY = 'dfr.history';

  // Các phần tử của trang đổi quà. Nếu Garena đổi giao diện, chỉ cần sửa ở đây.
  const SEL = {
    stateAfter: '.main-box .state-after', // khối hiện khi đã đăng nhập
    stateBefore: '.main-box .state-before', // khối hiện khi chưa đăng nhập
    input: '.main-box .exc-input',
    button: '.main-box .btn-exchange',
    tips: '#superTips', // thông báo lỗi, tự ẩn sau 2 giây
    dialog: '#diaTips', // hộp thoại khi đổi thành công
    dialogText: '#diaTips p',
    dialogClose: '#diaTips .btn-close',
  };
  const $ = (selector) => document.querySelector(selector);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Bấm như người dùng. Các nút của trang là <a href="javascript:void(0)">: chặn việc mở
   * link rỗng đó (Chrome sẽ báo lỗi CSP), còn trình xử lý click của trang vẫn chạy bình thường.
   */
  function clickElement(el) {
    el.addEventListener('click', (event) => event.preventDefault(), { once: true });
    el.click();
  }

  let myTabId = null;
  let job = null;
  let loopActive = false;
  let pauseRequested = false;
  let wakeUp = null;
  let lastSettledAt = 0; // lúc request đổi code gần nhất kết thúc

  // ------------------------------------------------------------------ lưu trữ

  function contextAlive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false; // extension vừa bị tải lại hoặc gỡ
    }
  }

  async function loadJob() {
    const stored = await chrome.storage.local.get(JOB_KEY);
    return stored[JOB_KEY] || null;
  }

  async function saveJob() {
    if (!job || !contextAlive()) return;
    job.updatedAt = Date.now();
    try {
      await chrome.storage.local.set({ [JOB_KEY]: job });
    } catch (_) {
      // extension vừa bị tải lại: không lưu được nữa
    }
  }

  const log = (kind, text, code) => pushLog(job, kind, text, code);

  // ------------------------------------------------------------------ đọc trang

  function loginState() {
    const after = $(SEL.stateAfter);
    const before = $(SEL.stateBefore);
    if (!after || !before || !$(SEL.input) || !$(SEL.button)) return 'unsupported';
    if (after.classList.contains('show')) return 'in';
    if (before.classList.contains('show')) return 'out';
    return 'loading';
  }

  function loginProblem(state) {
    if (state === 'out') return 'Bạn chưa đăng nhập trên trang đổi quà.';
    if (state === 'loading') return 'Trang đổi quà chưa tải xong, chờ vài giây rồi thử lại.';
    return 'Không tìm thấy ô nhập code trên trang, có thể Garena đã đổi giao diện.';
  }

  function isDialogOpen() {
    const dialog = $(SEL.dialog);
    return Boolean(dialog) && getComputedStyle(dialog).display !== 'none';
  }

  function isTipShowing() {
    const tips = $(SEL.tips);
    return Boolean(tips) && tips.classList.contains('show') && !tips.classList.contains('hide');
  }

  function readPageMessage() {
    if (isDialogOpen()) return { where: 'dialog', text: ($(SEL.dialogText)?.textContent || '').trim() };
    if (isTipShowing()) return { where: 'tips', text: ($(SEL.tips)?.textContent || '').trim() };
    return null;
  }

  /** Chờ tới khi predicate() đúng hoặc hết giờ, theo dõi thay đổi DOM thay vì hỏi liên tục. */
  function waitFor(predicate, timeoutMs) {
    return new Promise((resolve) => {
      if (predicate()) {
        resolve(true);
        return;
      }
      const observer = new MutationObserver(() => {
        if (predicate()) finish(true);
      });
      const timer = setTimeout(() => finish(false), timeoutMs);
      function finish(value) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      }
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  }

  /**
   * Chờ giữa 2 code. Nhờ service worker đếm giờ vì Chrome làm chậm setTimeout của
   * tab chạy nền; nếu không được thì tự đếm. Bấm "Tạm dừng" sẽ cắt ngang ngay.
   */
  function sleep(ms) {
    return new Promise((resolve) => {
      const started = Date.now();
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        wakeUp = null;
        resolve();
      };
      const fallback = () => setTimeout(done, Math.max(0, ms - (Date.now() - started)));
      wakeUp = done;
      try {
        chrome.runtime.sendMessage({ type: 'dfr:sleep', ms }).then(done, fallback);
      } catch (_) {
        fallback();
      }
    });
  }

  // ------------------------------------------------------------------ đổi 1 code

  /** Hỏi page-hook.js có đang hoạt động không; nó trả lời ngay (đồng bộ) qua sự kiện DOM. */
  function hookReady() {
    let ready = false;
    const onReply = (event) => {
      try {
        ready = ready || JSON.parse(event.detail).phase === 'ready';
      } catch (_) {
        // bỏ qua
      }
    };
    document.addEventListener(HOOK_EVENT, onReply);
    document.dispatchEvent(new CustomEvent(HOOK_PING_EVENT));
    document.removeEventListener(HOOK_EVENT, onReply);
    return ready;
  }

  /** Đổi 1 code như người dùng: điền → bấm "Đổi" → chờ kết quả. */
  async function redeemOne(code) {
    const input = $(SEL.input);
    const button = $(SEL.button);
    if (!input || !button) return { kind: 'fatal', text: loginProblem('unsupported') };

    await closeDialog();
    // Trang bỏ qua thông báo mới nếu thông báo cũ còn đang hiện.
    await waitFor(() => !isTipShowing(), 4000);
    // Sau mỗi lần đổi, trang khóa nút "Đổi" thêm 1 giây; bấm sớm hơn sẽ bị bỏ qua.
    const lockLeft = lastSettledAt + PAGE_LOCK_MS - Date.now();
    if (lockLeft > 0) await wait(lockLeft);

    input.value = code;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (input.value !== code) return { kind: 'fatal', text: 'Không điền được code vào ô nhập của trang.' };

    const outcome = waitForOutcome(code, hookReady());
    clickElement(button);
    const result = await outcome;
    lastSettledAt = Date.now();
    return result;
  }

  /**
   * Ưu tiên kết quả chính xác từ phản hồi máy chủ (do page-hook.js báo). Nếu không có,
   * dùng thông báo hiện trên trang; sau 45 giây vẫn không có gì thì coi là lỗi mạng.
   * Khi page-hook.js hoạt động mà sau 5 giây trang vẫn chưa gửi request thì báo ngay.
   */
  function waitForOutcome(code, expectSent) {
    return new Promise((resolve) => {
      let settled = false;
      let sent = false;
      let pageTimer = 0;
      let sendTimer = 0;
      let timeoutTimer = 0;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        document.removeEventListener(HOOK_EVENT, onApiResult);
        observer.disconnect();
        clearTimeout(pageTimer);
        clearTimeout(sendTimer);
        clearTimeout(timeoutTimer);
        resolve(result);
      };
      const onApiResult = (event) => {
        let detail;
        try {
          detail = JSON.parse(event.detail);
        } catch (_) {
          return;
        }
        if (!detail || (detail.cdkey && detail.cdkey !== code)) return; // kết quả của code khác
        if (detail.phase === 'sent') sent = true;
        if (detail.phase === 'done') finish(describeApiResult(detail));
      };
      const onPageChange = () => {
        if (pageTimer) return;
        const message = readPageMessage();
        if (message) pageTimer = setTimeout(() => finish(describePageMessage(message)), 2500);
      };
      const observer = new MutationObserver(onPageChange);
      for (const selector of [SEL.tips, SEL.dialog]) {
        const el = $(selector);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      document.addEventListener(HOOK_EVENT, onApiResult);
      if (expectSent) {
        sendTimer = setTimeout(() => {
          if (!sent && !pageTimer) finish({ kind: 'network', text: 'Trang chưa gửi yêu cầu đổi code sau khi bấm "Đổi".' });
        }, SEND_TIMEOUT_MS);
      }
      timeoutTimer = setTimeout(
        () => finish({ kind: 'network', text: 'Không nhận được phản hồi từ máy chủ Garena.' }),
        RESULT_TIMEOUT_MS,
      );
    });
  }

  async function closeDialog() {
    if (!isDialogOpen()) return;
    const close = $(SEL.dialogClose);
    if (close) clickElement(close);
    await waitFor(() => !isDialogOpen(), 2000);
  }

  /** Đổi thành công thì trang mở hộp thoại: đợi hiệu ứng mở (~400ms) xong rồi đóng lại. */
  async function dismissSuccessDialog() {
    if (!(await waitFor(isDialogOpen, 2000))) return;
    await wait(800);
    await closeDialog();
  }

  function clearInput() {
    const input = $(SEL.input);
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ------------------------------------------------------------------ vòng lặp

  function pauseJob(reason, kind = 'warn') {
    job.status = 'paused';
    job.current = null;
    job.pauseReason = reason;
    log(kind, reason);
  }

  function finishJob() {
    const s = summarize(job);
    job.status = 'done';
    job.current = null;
    job.pauseReason = '';
    job.finishedAt = Date.now();
    log('info', `Hoàn tất ${s.total} code: ${s.success} thành công, ${s.used} đã nhận trước đó, `
      + `${s.invalid} không dùng được, ${s.failed} lỗi.`);
    clearInput();
    // Lưu vào lịch sử để popup tab "Lịch sử" hiển thị.
    appendHistory();
  }

  async function appendHistory() {
    if (!job || !contextAlive()) return;
    try {
      const stored = await chrome.storage.local.get(HISTORY_KEY);
      const list = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
      const compact = {
        id: job.id,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt || Date.now(),
        delayMs: job.delayMs,
        summary: summarize(job),
        items: job.items.map((it) => ({
          code: it.code, status: it.status, message: it.message, attempts: it.attempts, at: it.at,
        })),
      };
      list.unshift(compact);
      list.length = Math.min(list.length, MAX_HISTORY);
      await chrome.storage.local.set({ [HISTORY_KEY]: list });
    } catch (_) { /* extension đang tải lại */ }
  }

  async function runLoop() {
    loopActive = true;
    pauseRequested = false;
    let networkStreak = 0;
    let unknownStreak = 0;
    try {
      while (contextAlive()) {
        if (pauseRequested) {
          pauseJob('Đã tạm dừng.');
          break;
        }
        const index = job.items.findIndex((item) => item.status === 'pending');
        if (index === -1) {
          finishJob();
          break;
        }
        const state = loginState();
        if (state !== 'in') {
          pauseJob(`${loginProblem(state)} Xử lý xong thì nhấn "Tiếp tục".`, 'error');
          break;
        }

        const item = job.items[index];
        const label = `[${index + 1}/${job.items.length}]`;
        job.current = { phase: 'redeeming', index, code: item.code, attempt: item.attempts + 1, since: Date.now() };
        await saveJob();

        const result = await redeemOne(item.code);
        if (!contextAlive()) return;

        if (result.kind === 'fatal') {
          pauseJob(result.text, 'error');
          break;
        }
        if (result.kind === 'session') {
          // Trang sẽ tự đăng nhập lại và tải lại; code này vẫn giữ trạng thái chờ đổi.
          pauseJob(`${label} ${item.code}: ${result.text} Đăng nhập lại rồi nhấn "Tiếp tục".`, 'error');
          break;
        }

        item.attempts += 1;
        networkStreak = result.kind === 'network' ? networkStreak + 1 : 0;
        unknownStreak = result.unknown ? unknownStreak + 1 : 0;
        const willRetry = result.kind === 'network' && item.attempts < MAX_ATTEMPTS;
        if (willRetry) {
          log('warn', `${label} ${result.text} Sẽ thử lại (lần ${item.attempts + 1}/${MAX_ATTEMPTS}).`, item.code);
        } else {
          item.status = result.kind;
          item.message = result.text;
          item.resultCode = result.code ?? null;
          item.at = Date.now();
          log(result.kind, `${label} ${result.text}`, item.code);
        }

        if (result.kind === 'success') await dismissSuccessDialog();

        if (!job.items.some((it) => it.status === 'pending')) {
          finishJob();
          break;
        }
        if (networkStreak >= MAX_NETWORK_STREAK) {
          pauseJob('Lỗi mạng nhiều lần liên tiếp nên tạm dừng để tránh bị Garena chặn. '
            + 'Chờ vài phút rồi nhấn "Tiếp tục".', 'error');
          break;
        }
        if (unknownStreak >= MAX_UNKNOWN_STREAK) {
          pauseJob(`Máy chủ trả mã lạ ${unknownStreak} lần liên tiếp, có thể đang bị giới hạn nên tạm dừng. `
            + 'Chờ vài phút rồi nhấn "Tiếp tục"; các code này đổi lại được bằng "Thử lại code lỗi".', 'error');
          break;
        }
        if (pauseRequested) continue;

        // Delay: ưu tiên delay riêng của từng code, fallback về delay mặc định của job.
        // Retry thì nhân đôi (vì lỗi mạng → chờ lâu hơn trước khi thử lại).
        const baseDelayMs = item.delayMs != null ? item.delayMs : job.delayMs;
        const waitMs = willRetry ? baseDelayMs * 2 : baseDelayMs;
        job.current = { phase: 'waiting', until: Date.now() + waitMs, nextDelayMs: waitMs };
        await saveJob();
        await sleep(waitMs);
      }
    } catch (error) {
      if (contextAlive() && job) {
        pauseJob(`Lỗi không mong muốn: ${error && error.message ? error.message : error}`, 'error');
      }
    } finally {
      loopActive = false;
      wakeUp = null;
      await saveJob();
    }
  }

  // ------------------------------------------------------------------ lệnh từ popup

  function sanitizeCodes(codes) {
    if (!Array.isArray(codes)) return [];
    const out = [];
    const seen = new Set();
    for (const entry of codes) {
      // Hỗ trợ cả string thuần (legacy) lẫn object {code, delayMs}
      let code, delayMs = null;
      if (typeof entry === 'string') {
        code = entry;
      } else if (entry && typeof entry === 'object') {
        code = entry.code;
        delayMs = entry.delayMs;
      }
      if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(code)) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      // Chuẩn hoá delay: nếu có thì clamp vào khoảng hợp lý (0.5s – 60s)
      let delay = null;
      if (Number.isFinite(delayMs)) {
        const ms = Math.max(500, Math.min(60000, Math.round(delayMs)));
        delay = ms - ms % 500; // snap về step 500ms
        if (delay < 500) delay = 500;
      }
      out.push({ code, delayMs: delay });
    }
    return out.slice(0, 2000);
  }

  function createJob(codes, delayMs) {
    const now = Date.now();
    return {
      id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      status: 'running',
      tabId: myTabId,
      delayMs: clampDelay(delayMs),
      items: codes.map((entry) => ({
        code: entry.code,
        delayMs: entry.delayMs, // null nếu dùng delay mặc định
        status: 'pending',
        attempts: 0,
        message: '',
        resultCode: null,
        at: 0,
      })),
      logs: [],
      current: null,
      pauseReason: '',
      createdAt: now,
      updatedAt: now,
      finishedAt: 0,
    };
  }

  async function handleMessage(msg) {
    switch (msg.type) {
      case 'dfr:status':
        return { ok: true, tabId: myTabId, running: loopActive, login: loginState() };

      case 'dfr:start': {
        if (loopActive) return { ok: false, error: 'Đang đổi code rồi.' };
        const codes = sanitizeCodes(msg.codes);
        if (!codes.length) return { ok: false, error: 'Chưa có code nào để đổi.' };
        const state = loginState();
        if (state !== 'in') return { ok: false, error: loginProblem(state) };
        job = createJob(codes, msg.delayMs);
        log('info', `Bắt đầu đổi ${codes.length} code, chờ ${formatSeconds(job.delayMs)} giữa mỗi code.`);
        await saveJob();
        runLoop();
        return { ok: true };
      }

      case 'dfr:resume': {
        if (loopActive) return { ok: true };
        const stored = await loadJob();
        if (!stored || !stored.items.some((item) => item.status === 'pending')) {
          return { ok: false, error: 'Không còn code nào chờ đổi.' };
        }
        const state = loginState();
        if (state !== 'in') return { ok: false, error: loginProblem(state) };
        job = stored;
        job.status = 'running';
        job.tabId = myTabId;
        job.pauseReason = '';
        if (msg.delayMs) job.delayMs = clampDelay(msg.delayMs);
        log('info', `Tiếp tục đổi ${summarize(job).pending} code còn lại.`);
        await saveJob();
        runLoop();
        return { ok: true };
      }

      case 'dfr:pause': {
        if (loopActive) {
          pauseRequested = true;
          if (wakeUp) wakeUp();
          return { ok: true };
        }
        const stored = await loadJob();
        if (stored && stored.status === 'running') {
          job = stored;
          pauseJob('Đã tạm dừng.');
          await saveJob();
        }
        return { ok: true };
      }

      case 'dfr:setDelay':
        if (loopActive && job) {
          job.delayMs = clampDelay(msg.delayMs);
          await saveJob();
        }
        return { ok: true };

      default:
        return { ok: false, error: 'Lệnh không hợp lệ.' };
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || sender.id !== chrome.runtime.id) return undefined;
    handleMessage(msg).then(sendResponse, (error) => {
      sendResponse({ ok: false, error: String((error && error.message) || error) });
    });
    return true;
  });

  // Trang bị tải lại giữa chừng (F5, hết phiên đăng nhập...) → chuyển sang tạm dừng.
  (async () => {
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'dfr:whoami' });
      myTabId = reply && typeof reply.tabId === 'number' ? reply.tabId : null;
      const stored = await loadJob();
      if (!loopActive && stored && stored.status === 'running' && myTabId !== null && stored.tabId === myTabId) {
        job = stored;
        pauseJob('Trang vừa được tải lại nên tiến trình tạm dừng. Kiểm tra đăng nhập rồi nhấn "Tiếp tục".');
        await saveJob();
      }
    } catch (_) {
      // extension đang tải lại: bỏ qua
    }
  })();
})();
