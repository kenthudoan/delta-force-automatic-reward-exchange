/*
 * Popup điều khiển. Chỉ hiển thị trạng thái (đọc từ chrome.storage.local) và gửi lệnh
 * cho content.js ở tab đổi quà. Việc đổi code chạy trong tab đó, nên đóng popup
 * không làm dừng tiến trình.
 *
 * v1.1.0: tabs (Đổi / Lịch sử / Donate), QR Techcombank 397983, export CSV, lưu lịch sử.
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
    estimateTotalMs,
  } = globalThis.DFR;

  const DFRQR = globalThis.DFRQR;

  const AVG_REQUEST_MS = 1500;
  const MAX_HISTORY = 30; // giữ tối đa 30 job gần nhất

  // Thông tin donate (chỉnh tên + nội dung nếu muốn)
  const DONATE = {
    bankBin: '970407',
    account: '397983',
    name: 'TRAN VAN THONG',  // tên chủ tài khoản Techcombank
    city: 'HA NOI',
    defaultMessage: 'DONATE',
  };
  const HISTORY_KEY = 'dfr.history';

  const ui = {};
  for (const id of [
    'pageStatus', 'pageStatusText', 'openPage', 'focusPage', 'inputCard', 'codes', 'parseCount',
    'parseNotes', 'suspicious', 'suspiciousList', 'delay', 'delayOut', 'start', 'pause', 'resume',
    'retry', 'reset', 'flash', 'progressCard', 'progressText', 'progressPercent', 'currentText', 'barFill', 'pauseReason',
    'stats', 'log', 'logEmpty', 'copy', 'exportCsv', 'clearCodes', 'loadSample', 'importFile',
    'history', 'historyEmpty', 'clearHistory',
    'qrFrame', 'qrAccount', 'qrName', 'qrRaw', 'donateAmount', 'openDonate',
  ]) {
    ui[id] = document.getElementById(id);
  }

  let job = null;
  let target = null;
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
    if (ms <= 0) return '0 giây';
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds} giây`;
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return `khoảng ${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `khoảng ${hours} giờ${rest ? ` ${rest} phút` : ''}`;
  }

  function formatClock(t) {
    return new Date(t).toLocaleTimeString('vi-VN', { hour12: false });
  }

  function formatDate(t) {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function formatRelative(t) {
    if (!t) return '';
    const diff = Date.now() - t;
    const sec = Math.round(diff / 1000);
    if (sec < 30) return 'vừa xong';
    if (sec < 60) return `${sec} giây trước`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} phút trước`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day} ngày trước`;
    return formatDate(t);
  }

  function formatTimeRange(start, end) {
    if (!start) return '—';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const sameDay = s.toDateString() === e.toDateString();
    const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = (d) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (sameDay) {
      return `${date(s)} · ${time(s)} → ${time(e)}`;
    }
    return `${date(s)} ${time(s)} → ${date(e)} ${time(e)}`;
  }

  function formatDurationExact(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec} giây`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return `${min} phút ${sec} giây`;
    const hr = Math.floor(min / 60);
    const restMin = min % 60;
    return `${hr} giờ ${restMin} phút${sec ? ` ${sec} giây` : ''}`;
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

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = el('textarea', { value: text });
      document.body.append(area);
      area.select();
      try { document.execCommand('copy'); } catch (__) {}
      area.remove();
      return false;
    }
  }

  // ------------------------------------------------------------------ tabs

  function switchTab(name) {
    for (const tab of document.querySelectorAll('.tab')) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    }
    for (const panel of document.querySelectorAll('.tab-panel')) {
      panel.hidden = panel.dataset.tab !== name;
    }
    if (name === 'donate') renderDonate();
    if (name === 'history') renderHistory();
  }

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }
  ui.openDonate.addEventListener('click', () => switchTab('donate'));

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
    if (n) {
      const totalMs = estimateTotalMs(parsed.codes, currentDelay(), AVG_REQUEST_MS);
      const perCodeText = parsed.codes.some((c) => c.delaySec)
        ? ' (có delay riêng)'
        : '';
      ui.parseCount.textContent = `${n} code${perCodeText} · ${formatDuration(totalMs)}`;
    } else {
      ui.parseCount.textContent = '0 code';
    }

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
    ui.clearCodes.hidden = !ui.codes.value;
  }

  function onCodesChanged() {
    updateParseInfo();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveSettings({ draft: ui.codes.value }), 300);
    renderButtons();
  }

  // ------------------------------------------------------------------ import file

  function importCodesFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const merged = ui.codes.value
        ? (ui.codes.value + '\n' + text).trim()
        : text;
      ui.codes.value = merged;
      onCodesChanged();
      showFlash(`Đã nạp file "${file.name}" vào ô nhập. Kiểm tra rồi bấm Bắt đầu.`, 'ok', 4000);
    };
    reader.onerror = () => showFlash('Không đọc được file. Thử lại hoặc copy thủ công.', 'error');
    reader.readAsText(file);
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
    ui.reset.textContent = armed ? 'Bấm lần nữa để xoá' : 'Làm mới';
    ui.reset.classList.toggle('armed', armed);
  }

  function renderProgress() {
    ui.progressCard.hidden = !job;
    ui.copy.hidden = !job;
    ui.exportCsv.hidden = !job;
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
    // Ước tính còn lại: tính dựa trên delay riêng từng code nếu có
    if (running && s.pending) {
      const remaining = job.items
        .filter((it) => it.status === 'pending')
        .map((it) => ({ code: it.code, delaySec: it.delayMs ? it.delayMs / 1000 : null }));
      const totalMs = estimateTotalMs(remaining, job.delayMs, AVG_REQUEST_MS);
      text += ` · còn ${formatDuration(totalMs)}`;
    }
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

  // ------------------------------------------------------------------ CSV export

  function csvCell(value) {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function jobToCSV(j) {
    const headers = ['code', 'status', 'message', 'attempts', 'at'];
    const lines = [headers.join(',')];
    for (const it of j.items) {
      lines.push([it.code, it.status, it.message, it.attempts, it.at ? formatDate(it.at) : '']
        .map(csvCell).join(','));
    }
    return '\uFEFF' + lines.join('\r\n'); // BOM để Excel nhận UTF-8
  }

  function downloadCSV(j) {
    const csv = jobToCSV(j);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `delta-force-${j.id}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------------ Lịch sử

  async function getHistory() {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    return stored[HISTORY_KEY] || [];
  }

  async function appendHistory(j) {
    const list = await getHistory();
    // Lưu job đã chốt: không log, không current
    const compact = {
      id: j.id,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt || Date.now(),
      delayMs: j.delayMs,
      status: j.status,
      summary: summarize(j),
      items: j.items.map((it) => ({
        code: it.code,
        delayMs: it.delayMs,
        status: it.status,
        message: it.message,
        attempts: it.attempts,
        at: it.at,
      })),
    };
    list.unshift(compact);
    list.length = Math.min(list.length, MAX_HISTORY);
    await chrome.storage.local.set({ [HISTORY_KEY]: list });
  }

  async function renderHistory() {
    const list = await getHistory();
    ui.historyEmpty.hidden = list.length > 0;
    ui.clearHistory.hidden = list.length === 0;
    ui.history.replaceChildren(...list.map(historyItem));
  }

  function historyItem(h) {
    const s = h.summary;
    const dur = (h.finishedAt || Date.now()) - h.createdAt;
    const statusLabel = h.status === 'done' ? 'Hoàn tất'
      : h.status === 'paused' ? 'Tạm dừng'
      : h.status === 'running' ? 'Đang chạy'
      : h.status || '—';
    const statusClass = h.status === 'done' ? 'ok'
      : h.status === 'paused' ? 'warn'
      : h.status === 'running' ? 'todo'
      : '';
    const delaySec = Math.round((h.delayMs || 0) / 1000 * 10) / 10;

    const title = el('div', { className: 'title' }, [
      `Job `,
      el('span', { className: 'mono', textContent: `#${h.id.slice(0, 8)}` }),
    ]);
    const when = el('div', { className: 'when' });
    when.append(
      el('div', { className: 'when-row', textContent: formatTimeRange(h.createdAt, h.finishedAt) }),
      el('div', { className: 'when-row muted-row', textContent: `(${formatRelative(h.createdAt)})` }),
    );

    const summary = el('div', { className: 'summary' });
    const parts = [
      ['ok', '✓', 'Thành công', s.success],
      ['used', '↻', 'Đã nhận', s.used],
      ['bad', '✗', 'Lỗi', s.invalid],
      ['err', '!', 'Lỗi mạng', s.failed],
      ['todo', '·', 'Còn lại', s.pending],
    ];
    for (const [cls, icon, label, n] of parts) {
      if (!n) continue;
      summary.append(el('span', { className: cls, title: label, textContent: `${icon} ${n}` }));
    }
    summary.append(el('span', { className: 'meta', textContent: `${s.total} mã` }));
    summary.append(el('span', { className: 'meta', textContent: `⏱ ${formatDurationExact(dur)}` }));
    summary.append(el('span', { className: 'meta', textContent: `delay ${delaySec}s` }));

    const left = el('div', { className: 'history-left' }, [title, when]);

    const actions = el('div', { className: 'actions-col' });
    const btnExport = el('button', { type: 'button', className: 'link', textContent: 'Tải CSV' });
    btnExport.addEventListener('click', () => downloadCSV(h));
    actions.append(btnExport);

    if (s.failed > 0) {
      const btnRetry = el('button', { type: 'button', className: 'link', textContent: `Thử lại ${s.failed} lỗi` });
      btnRetry.title = 'Đổi lại các code lỗi (chuyển sang tab đổi code)';
      btnRetry.addEventListener('click', async () => {
        const failedCodes = h.items
          .filter((it) => it.status === 'network' || it.status === 'error')
          .map((it) => ({ code: it.code, delayMs: it.delayMs || null }));
        if (!failedCodes.length) return;
        // Đặt vào ô nhập và chuyển sang tab redeem
        const lines = h.items
          .filter((it) => it.status === 'network' || it.status === 'error')
          .map((it) => it.delayMs ? `${it.code}=${it.delayMs / 1000}` : it.code);
        ui.codes.value = lines.join('\n');
        onCodesChanged();
        switchTab('redeem');
        showFlash(`Đã nạp ${failedCodes.length} code lỗi vào ô nhập. Bấm Bắt đầu để chạy lại.`, 'ok', 4000);
      });
      actions.append(btnRetry);
    }

    const root = el('li', { className: `history-row ${statusClass}` }, [left, actions, summary]);
    return root;
  }

  // ------------------------------------------------------------------ Donate QR

  let qrRenderTimer = 0;
  let lastQrString = '';

  function renderDonate() {
    if (!DFRQR) {
      ui.qrFrame.textContent = 'Trình tạo QR chưa sẵn sàng.';
      return;
    }
    ui.qrAccount.textContent = DONATE.account;
    ui.qrName.textContent = DONATE.name;

    clearTimeout(qrRenderTimer);
    qrRenderTimer = setTimeout(updateDonateQR, 150);
  }

  function updateDonateQR() {
    if (!DFRQR) return;
    const amount = Number(ui.donateAmount.value);
    const payload = DFRQR.vietQR({
      bankBin: DONATE.bankBin,
      account: DONATE.account,
      name: DONATE.name,
      city: DONATE.city,
      message: DONATE.defaultMessage,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      service: 'QRIBFTTA',
    });

    if (payload === lastQrString && ui.qrFrame.firstChild) return;
    lastQrString = payload;

    // Size 240 + quiet zone 4 modules để camera app NH quét ổn định.
    const svg = DFRQR.toSVG(payload, { size: 240, margin: 4, dark: '#0e9b6c', light: '#ffffff' });
    ui.qrFrame.innerHTML = svg;
    ui.qrRaw.textContent = payload;
  }

  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const ok = await copyText(btn.dataset.copy);
      showFlash(ok ? 'Đã sao chép.' : 'Không sao chép được, copy thủ công nhé.', ok ? 'ok' : 'error', 2500);
    });
  }
  ui.donateAmount.addEventListener('input', () => {
    lastQrString = '';
    updateDonateQR();
  });

  // ------------------------------------------------------------------ nút bấm

  ui.codes.addEventListener('input', onCodesChanged);
  ui.clearCodes.addEventListener('click', () => {
    ui.codes.value = '';
    onCodesChanged();
    ui.codes.focus();
  });
  ui.loadSample.addEventListener('click', () => {
    ui.codes.value = ['DFREWARD2026', 'DFGIFT666', 'DFPRO-2026', 'DELTA-VIP-123', 'TESTCODE42'].join('\n');
    onCodesChanged();
  });
  ui.importFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importCodesFromFile(file);
    e.target.value = ''; // cho phép chọn lại cùng file
  });

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
    // Chuyển parsed.codes (đối tượng {code, delaySec}) sang định dạng content.js hiểu
    const payload = parsed.codes.map((c) => ({
      code: c.code,
      delayMs: c.delaySec ? c.delaySec * 1000 : null,
    }));
    const reply = await send({ type: 'dfr:start', codes: payload, delayMs: currentDelay() });
    if (reply && reply.ok) {
      ui.codes.value = parsed.suspicious.map((s) => s.token).join('\n');
      onCodesChanged();
      ui.flash.hidden = true;
    }
  });

  ui.pause.addEventListener('click', () => send({ type: 'dfr:pause' }));

  ui.resume.addEventListener('click', () => send({ type: 'dfr:resume', delayMs: currentDelay() }));

  ui.retry.addEventListener('click', async () => {
    const failed = job.items.filter((it) => it.status === 'network' || it.status === 'error');
    if (!failed.length) return;
    const codes = failed.map((it) => ({ code: it.code, delayMs: it.delayMs || null }));
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
    // Trước khi xoá: nếu job đã có code xong, lưu vào lịch sử
    if (job) {
      const s = summarize(job);
      if (s.done > 0) await appendHistory(job);
    }
    await chrome.storage.local.remove(JOB_KEY);
    job = null;
    ui.flash.hidden = true;
    render();
  });

  ui.copy.addEventListener('click', async () => {
    if (!job) return;
    const lines = job.items.map((it) => (it.status === 'pending'
      ? `${it.code}\t${KIND_LABEL.pending}`
      : `${it.code}\t${KIND_LABEL[it.status] || it.status}\t${it.message}`));
    const text = lines.join('\n');
    const ok = await copyText(text);
    showFlash(ok
      ? `Đã sao chép kết quả của ${lines.length} code (dán được vào Excel/Google Sheets).`
      : 'Không sao chép được, copy thủ công nhé.', ok ? 'ok' : 'error', 3000);
  });

  ui.exportCsv.addEventListener('click', () => {
    if (!job) return;
    downloadCSV(job);
    showFlash(`Đã tải file CSV (${job.items.length} dòng).`, 'ok', 2500);
  });

  ui.clearHistory.addEventListener('click', async () => {
    if (!confirm('Xoá toàn bộ lịch sử đổi code? Hành động này không thể hoàn tác.')) return;
    await chrome.storage.local.remove(HISTORY_KEY);
    renderHistory();
  });

  ui.openPage.addEventListener('click', () => chrome.tabs.create({ url: REDEEM_URL }));

  ui.focusPage.addEventListener('click', async () => {
    if (!target) return;
    await chrome.tabs.update(target.tab.id, { active: true });
    await chrome.windows.update(target.tab.windowId, { focused: true });
  });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    if (changes[JOB_KEY]) {
      const statusBefore = job ? job.status : null;
      const newJob = changes[JOB_KEY].newValue || null;
      job = newJob;

      // Nếu vừa chuyển sang done → lưu vào lịch sử
      if (statusBefore !== 'done' && newJob && newJob.status === 'done') {
        try { await appendHistory(newJob); } catch (_) {}
      }

      render();
      if ((job ? job.status : null) !== statusBefore) refreshTarget();
    }
    if (changes[HISTORY_KEY]) renderHistory();
  });

  // ------------------------------------------------------------------ phím tắt

  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter → bấm Bắt đầu (khi đang ở tab redeem và nút start hiện)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !ui.start.hidden) {
      e.preventDefault();
      ui.start.click();
    }
    // Esc → đóng flash
    if (e.key === 'Escape' && !ui.flash.hidden) {
      ui.flash.hidden = true;
    }
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
