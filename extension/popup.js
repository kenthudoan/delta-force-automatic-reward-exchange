/*
 * Popup điều khiển. Chỉ hiển thị trạng thái (đọc từ chrome.storage.local) và gửi lệnh
 * cho content.js ở tab đổi quà. Việc đổi code chạy trong tab đó, nên đóng popup
 * không làm dừng tiến trình.
 */
(() => {
  'use strict';

  const {
    JOB_KEY,
    SETTINGS_KEY,
    REDEEM_URL,
    REDEEM_MATCH,
    DELAY,
    KIND_LABEL,
    parseCodes,
    clampDelay,
    summarize,
    formatSeconds,
  } = globalThis.DFR;

  const AVG_REQUEST_MS = 1500; // thời gian trung bình trang xử lý 1 code, dùng để ước tính

  const ui = {};
  for (const id of [
    'pageStatus', 'pageStatusText', 'openPage', 'focusPage', 'inputCard', 'codes', 'parseCount',
    'parseNotes', 'suspicious', 'suspiciousList', 'delay', 'delayOut', 'start', 'pause', 'resume',
    'retry', 'reset', 'flash', 'progressCard', 'progressText', 'progressPercent', 'currentText', 'barFill', 'pauseReason',
    'stats', 'log', 'logEmpty', 'copy',
  ]) {
    ui[id] = document.getElementById(id);
  }

  let job = null;
  let target = null; // { tab, reachable, running, login }
  let parsed = parseCodes('');
  let resetArmedUntil = 0;
  let flashTimer = 0;
  let draftTimer = 0;
  const rendered = { jobId: null, count: 0, firstT: 0 };

  // ------------------------------------------------------------------ tiện ích

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const child of children) node.append(child);
    return node;
  }

  function formatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return 'dưới 1 phút';
    if (minutes < 60) return `khoảng ${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `khoảng ${hours} giờ${rest ? ` ${rest} phút` : ''}`;
  }

  function formatClock(t) {
    return new Date(t).toLocaleTimeString('vi-VN', { hour12: false });
  }

  const currentDelay = () => clampDelay(Number(ui.delay.value) * 1000);

  function showFlash(text, tone = 'info', ms = 6000) {
    clearTimeout(flashTimer);
    ui.flash.textContent = text;
    ui.flash.dataset.tone = tone;
    ui.flash.hidden = false;
    if (ms) flashTimer = setTimeout(() => { ui.flash.hidden = true; }, ms);
  }

  async function saveSettings(patch) {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    await chrome.storage.local.set({ [SETTINGS_KEY]: { ...(stored[SETTINGS_KEY] || {}), ...patch } });
  }

  // ------------------------------------------------------------------ tab đổi quà

  async function refreshTarget() {
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ url: REDEEM_MATCH });
    } catch (_) {
      tabs = [];
    }
    const probes = await Promise.all(tabs.map(async (tab) => {
      try {
        const reply = await chrome.tabs.sendMessage(tab.id, { type: 'dfr:status' });
        return { tab, reachable: true, running: Boolean(reply && reply.running), login: reply && reply.login };
      } catch (_) {
        return { tab, reachable: false, running: false, login: null };
      }
    }));
    target = probes.find((p) => p.running)
      || probes.find((p) => p.reachable && p.tab.active)
      || probes.find((p) => p.reachable)
      || probes[0]
      || null;
    render();
  }

  async function send(msg) {
    if (!target || !target.reachable) {
      showFlash('Chưa kết nối được với trang đổi quà. Hãy mở trang và tải lại (F5).', 'error');
      return null;
    }
    try {
      const reply = await chrome.tabs.sendMessage(target.tab.id, msg);
      if (reply && !reply.ok) showFlash(reply.error || 'Không thực hiện được lệnh.', 'error');
      return reply;
    } catch (_) {
      showFlash('Không gửi được lệnh tới trang đổi quà. Hãy tải lại trang (F5) rồi thử lại.', 'error');
      return null;
    } finally {
      refreshTarget();
    }
  }

  // ------------------------------------------------------------------ nhập code

  function updateParseInfo() {
    parsed = parseCodes(ui.codes.value);
    const n = parsed.codes.length;
    ui.parseCount.textContent = n
      ? `${n} code · ${formatDuration(n * (currentDelay() + AVG_REQUEST_MS))}`
      : '0 code';

    const notes = [];
    if (parsed.duplicates) notes.push(`Bỏ ${parsed.duplicates} code trùng.`);
    if (parsed.ignored.length) {
      const sample = [...new Set(parsed.ignored)].slice(0, 6).join(', ');
      const more = parsed.ignored.length > 6 ? ', …' : '';
      notes.push(`Bỏ qua ${parsed.ignored.length} từ không phải code (ngắn hơn 6 ký tự, toàn số hoặc có dấu): ${sample}${more}.`);
    }
    ui.parseNotes.textContent = notes.join(' ');
    ui.parseNotes.hidden = notes.length === 0;

    ui.suspiciousList.replaceChildren(...parsed.suspicious.map(({ token, suggestion }) => {
      const shown = el('code');
      for (const ch of token) shown.append(/[A-Za-z0-9_-]/.test(ch) ? ch : el('mark', { textContent: ch }));
      const fix = el('button', { type: 'button', className: 'small-btn', textContent: 'Sửa' });
      fix.addEventListener('click', () => {
        ui.codes.value = ui.codes.value.split(token).join(suggestion);
        onCodesChanged();
      });
      return el('li', {}, [shown, ' → ', el('code', { textContent: suggestion }), fix]);
    }));
    ui.suspicious.hidden = parsed.suspicious.length === 0;
  }

  function onCodesChanged() {
    updateParseInfo();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveSettings({ draft: ui.codes.value }), 300);
    renderButtons();
  }

  // ------------------------------------------------------------------ hiển thị

  function render() {
    renderPageStatus();
    renderButtons();
    renderProgress();
    renderLog();
  }

  function setPageStatus(text, tone, { open = false, focus = false } = {}) {
    ui.pageStatus.dataset.tone = tone;
    ui.pageStatusText.textContent = text;
    ui.openPage.hidden = !open;
    ui.focusPage.hidden = !focus;
  }

  function renderPageStatus() {
    if (!target) {
      setPageStatus('Chưa mở trang đổi quà Delta Force.', 'warn', { open: true });
    } else if (!target.reachable && target.tab.status === 'loading') {
      setPageStatus('Trang đổi quà đang tải…', 'muted', { focus: !target.tab.active });
    } else if (!target.reachable) {
      setPageStatus('Trang đổi quà đang mở nhưng chưa kết nối. Hãy tải lại trang đó (F5).', 'warn', { focus: true });
    } else if (target.login === 'in') {
      const where = target.tab.active ? '' : ' (ở tab khác)';
      setPageStatus(`Đã kết nối trang đổi quà · đã đăng nhập${where}.`, 'ok', { focus: !target.tab.active });
    } else if (target.login === 'out') {
      setPageStatus('Bạn chưa đăng nhập trên trang đổi quà.', 'warn', { focus: true });
    } else if (target.login === 'loading') {
      setPageStatus('Trang đổi quà đang tải…', 'muted', { focus: !target.tab.active });
    } else {
      setPageStatus('Không nhận ra giao diện trang đổi quà (có thể Garena đã thay đổi).', 'error', { focus: true });
    }
  }

  function jobFlags() {
    const s = summarize(job);
    const tabRunning = Boolean(target && target.running);
    // Trạng thái đã lưu mới hơn lần hỏi tab gần nhất, nên cần cả hai cùng báo "đang chạy".
    const running = tabRunning && Boolean(job) && job.status === 'running';
    const interrupted = Boolean(job) && job.status === 'running' && !tabRunning;
    return { running, s, interrupted };
  }

  function renderButtons() {
    const { running, s } = jobFlags();
    const ready = Boolean(target && target.reachable);
    const canStartNew = !running && (!job || s.pending === 0);

    ui.inputCard.hidden = !canStartNew;
    ui.start.hidden = !canStartNew;
    ui.start.disabled = !ready || parsed.codes.length === 0;
    ui.pause.hidden = !running;
    ui.resume.hidden = running || !job || s.pending === 0;
    ui.resume.disabled = !ready;
    ui.retry.hidden = !canStartNew || !job || s.failed === 0;
    ui.retry.disabled = !ready;
    ui.reset.hidden = running || !job;
    const armed = Date.now() < resetArmedUntil;
    ui.reset.textContent = armed ? 'Bấm lần nữa để xóa' : 'Làm mới';
    ui.reset.classList.toggle('armed', armed);
  }

  function renderProgress() {
    ui.progressCard.hidden = !job;
    ui.copy.hidden = !job;
    if (!job) return;
    const { s } = jobFlags();
    const percent = s.total ? Math.floor((s.done / s.total) * 100) : 0;
    ui.progressText.textContent = `${s.done}/${s.total} code`;
    ui.progressPercent.textContent = `${percent}%`;
    ui.barFill.style.width = `${percent}%`;
    const paused = job.status === 'paused' && job.pauseReason;
    ui.pauseReason.hidden = !paused;
    ui.pauseReason.textContent = paused ? job.pauseReason : '';
    ui.stats.replaceChildren(
      ...[
        ['success', 'Thành công', s.success],
        ['used', 'Đã nhận trước đó', s.used],
        ['invalid', 'Không dùng được', s.invalid],
        ['failed', 'Lỗi', s.failed],
        ['pending', 'Còn lại', s.pending],
      ].map(([cls, label, n]) => el('li', { className: cls }, [`${label} `, el('b', { textContent: String(n) })])),
    );
    renderCurrent();
  }

  function renderCurrent() {
    if (!job) return;
    const { running, s, interrupted } = jobFlags();
    let text = '';
    const current = job.current;
    if (running && current && current.phase === 'redeeming') {
      text = `Đang đổi ${current.code}${current.attempt > 1 ? ` (lần ${current.attempt})` : ''}…`;
    } else if (running && current && current.phase === 'waiting') {
      const left = Math.max(0, current.until - Date.now());
      text = `Code tiếp theo sau ${formatSeconds(left)}`;
    } else if (interrupted) {
      text = 'Bị gián đoạn, nhấn "Tiếp tục"';
    } else if (job.status === 'paused') {
      text = 'Đã tạm dừng';
    } else if (job.status === 'done') {
      text = 'Hoàn tất';
    }
    if (running && s.pending) text += ` · còn ${formatDuration(s.pending * (job.delayMs + AVG_REQUEST_MS))}`;
    ui.currentText.textContent = text;
  }

  function logItem(entry) {
    const children = [el('time', { textContent: formatClock(entry.t) })];
    if (entry.code) {
      children.push(el('span', { className: 'code', textContent: entry.code }));
      children.push(el('span', { className: 'text', textContent: entry.text }));
    } else {
      children.push(el('span', { textContent: entry.text }));
    }
    return el('li', { className: entry.kind, title: KIND_LABEL[entry.kind] || '' }, children);
  }

  function renderLog() {
    const logs = job ? job.logs : [];
    ui.logEmpty.hidden = logs.length > 0;
    const nearBottom = ui.log.scrollHeight - ui.log.scrollTop - ui.log.clientHeight < 24;
    const sameJob = job && rendered.jobId === job.id && logs.length >= rendered.count
      && (logs.length === 0 || logs[0].t === rendered.firstT);
    if (sameJob) {
      ui.log.append(...logs.slice(rendered.count).map(logItem));
    } else {
      ui.log.replaceChildren(...logs.map(logItem));
    }
    rendered.jobId = job ? job.id : null;
    rendered.count = logs.length;
    rendered.firstT = logs.length ? logs[0].t : 0;
    if (nearBottom || !sameJob) ui.log.scrollTop = ui.log.scrollHeight;
  }

  // ------------------------------------------------------------------ nút bấm

  ui.codes.addEventListener('input', onCodesChanged);

  ui.delay.addEventListener('input', () => {
    ui.delayOut.textContent = formatSeconds(currentDelay());
    updateParseInfo();
  });

  ui.delay.addEventListener('change', () => {
    saveSettings({ delayMs: currentDelay() });
    if (target && target.running) send({ type: 'dfr:setDelay', delayMs: currentDelay() });
  });

  ui.start.addEventListener('click', async () => {
    parsed = parseCodes(ui.codes.value);
    if (!parsed.codes.length) {
      showFlash('Chưa có code hợp lệ nào để đổi.', 'error');
      return;
    }
    const reply = await send({ type: 'dfr:start', codes: parsed.codes, delayMs: currentDelay() });
    if (reply && reply.ok) {
      // Chỉ để lại trong ô những gì chưa được gửi (code có ký tự lạ) để sửa sau.
      ui.codes.value = parsed.suspicious.map((s) => s.token).join('\n');
      onCodesChanged();
      ui.flash.hidden = true;
    }
  });

  ui.pause.addEventListener('click', () => send({ type: 'dfr:pause' }));

  ui.resume.addEventListener('click', () => send({ type: 'dfr:resume', delayMs: currentDelay() }));

  ui.retry.addEventListener('click', async () => {
    const codes = job.items.filter((it) => it.status === 'network' || it.status === 'error').map((it) => it.code);
    if (!codes.length) return;
    await send({ type: 'dfr:start', codes, delayMs: currentDelay() });
  });

  ui.reset.addEventListener('click', async () => {
    if (Date.now() >= resetArmedUntil) {
      resetArmedUntil = Date.now() + 3000;
      renderButtons();
      setTimeout(renderButtons, 3100);
      return;
    }
    resetArmedUntil = 0;
    await chrome.storage.local.remove(JOB_KEY);
    ui.flash.hidden = true;
  });

  ui.copy.addEventListener('click', async () => {
    if (!job) return;
    const lines = job.items.map((it) => (it.status === 'pending'
      ? `${it.code}\t${KIND_LABEL.pending}`
      : `${it.code}\t${KIND_LABEL[it.status] || it.status}\t${it.message}`));
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = el('textarea', { value: text });
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showFlash(`Đã sao chép kết quả của ${lines.length} code (dán được vào Excel/Google Sheets).`, 'ok', 3000);
  });

  ui.openPage.addEventListener('click', () => chrome.tabs.create({ url: REDEEM_URL }));

  ui.focusPage.addEventListener('click', async () => {
    if (!target) return;
    await chrome.tabs.update(target.tab.id, { active: true });
    await chrome.windows.update(target.tab.windowId, { focused: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[JOB_KEY]) return;
    const statusBefore = job ? job.status : null;
    job = changes[JOB_KEY].newValue || null;
    render();
    if ((job ? job.status : null) !== statusBefore) refreshTarget();
  });

  // ------------------------------------------------------------------ khởi động

  (async () => {
    ui.delay.min = String(DELAY.min / 1000);
    ui.delay.max = String(DELAY.max / 1000);
    ui.delay.step = String(DELAY.step / 1000);
    const stored = await chrome.storage.local.get([JOB_KEY, SETTINGS_KEY]);
    const settings = stored[SETTINGS_KEY] || {};
    job = stored[JOB_KEY] || null;
    ui.codes.value = settings.draft || '';
    ui.delay.value = String(clampDelay(settings.delayMs ?? DELAY.default) / 1000);
    ui.delayOut.textContent = formatSeconds(currentDelay());
    updateParseInfo();
    render();
    await refreshTarget();
    setInterval(refreshTarget, 2000);
    setInterval(renderCurrent, 250);
  })();
})();
