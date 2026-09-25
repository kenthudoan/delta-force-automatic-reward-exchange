// Screenshot 1280×800 — Render popup NGUYÊN BẢN trên nền đơn giản
// Cách: load popup trực tiếp, set viewport 1280×800, override body { width: 460px; margin: auto }
// KHÔNG đụng HTML/CSS gốc, chỉ set CSS variables trên :root
import { chromium } from 'playwright';

const POPUP_FILE = 'file:///C:/Users/Admin/Downloads/delta-force-automatic-reward-exchange/extension/popup.html';

const browser = await chromium.launch();

async function shoot(state, outPath) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(POPUP_FILE);
  await page.waitForFunction(() => globalThis.DFR && globalThis.DFRQR);
  await page.waitForTimeout(500);

  // Inject page-level styles KHÔNG đụng popup body
  // Trick: set html background + canh body vào giữa bằng margin auto
  await page.addStyleTag({
    content: `
      :root { --popup-w: 460px !important; }
      html {
        background:
          radial-gradient(circle at 15% 20%, rgba(255,140,26,0.06) 0%, transparent 40%),
          radial-gradient(circle at 85% 80%, rgba(0,150,136,0.06) 0%, transparent 45%),
          linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%) !important;
      }
      body {
        margin: 16px auto !important;
        border-radius: 14px !important;
        box-shadow:
          0 30px 60px rgba(0,0,0,0.18),
          0 10px 20px rgba(0,0,0,0.10),
          0 0 0 1px rgba(0,0,0,0.04) !important;
        overflow: hidden !important;
      }
    `
  });

  // Setup state
  await page.evaluate((s) => {
    const doc = document;
    const status = doc.getElementById('pageStatus');
    const openBtn = doc.getElementById('openPage');
    if (s.connected) {
      status.dataset.tone = 'ok';
      doc.getElementById('pageStatusText').textContent = 'Đã kết nối trang đổi quà · đã đăng nhập.';
      openBtn.hidden = false;
    }
    const tabs = doc.querySelectorAll('.tab');
    const panels = doc.querySelectorAll('.tab-panel');
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    panels.forEach(p => p.hidden = true);
    const tab = doc.querySelector(`[data-tab="${s.tab}"]`);
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    doc.getElementById(`tab-${s.tab}`).hidden = false;

    if (s.tab === 'redeem') {
      if (s.codes) {
        const c = doc.getElementById('codes');
        c.value = s.codes.join('\n');
        c.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (s.delay != null) {
        const d = doc.getElementById('delay');
        d.value = s.delay;
        d.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (s.progress) {
        doc.getElementById('progressCard').hidden = false;
        doc.getElementById('progressText').textContent = s.progress.text;
        doc.getElementById('progressPercent').textContent = s.progress.percent;
        doc.getElementById('barFill').style.width = s.progress.percent;
        doc.getElementById('currentText').textContent = s.progress.current;
        const statsEl = doc.getElementById('stats');
        statsEl.innerHTML = '';
        for (const [cls, label, n] of s.progress.stats) {
          const li = doc.createElement('li');
          li.className = cls;
          li.innerHTML = `<b>${n}</b> ${label}`;
          statsEl.appendChild(li);
        }
        const logEl = doc.getElementById('log');
        logEl.innerHTML = '';
        for (const l of (s.progress.logs || [])) {
          const li = doc.createElement('li');
          li.className = 'log-row';
          li.innerHTML = `<span class="dot ${l.cls}"></span><span class="msg">${l.text}</span>`;
          logEl.appendChild(li);
        }
        doc.getElementById('logEmpty').style.display = 'none';
        doc.getElementById('start').hidden = true;
        doc.getElementById('pause').hidden = false;
      }
    } else if (s.tab === 'history') {
      doc.getElementById('historyEmpty').hidden = true;
      const ul = doc.getElementById('history');
      ul.innerHTML = '';
      for (const j of s.history) {
        const li = doc.createElement('li');
        li.className = 'history-row ' + j.cls;
        const left = doc.createElement('div');
        left.className = 'history-left';
        const title = doc.createElement('div');
        title.className = 'title';
        title.innerHTML = `Job <span class="mono">#${j.id}</span>`;
        left.appendChild(title);
        const when = doc.createElement('div');
        when.className = 'when';
        when.innerHTML = `<div class="when-row">${j.when}</div><div class="when-row muted-row">${j.ago}</div>`;
        left.appendChild(when);
        const sum = doc.createElement('div');
        sum.className = 'summary';
        for (const [c, i, n] of j.parts) {
          const span = doc.createElement('span');
          span.className = c;
          span.textContent = `${i} ${n}`;
          sum.appendChild(span);
        }
        li.appendChild(left);
        li.appendChild(sum);
        ul.appendChild(li);
      }
      doc.getElementById('clearHistory').hidden = false;
    } else if (s.tab === 'donate') {
      doc.getElementById('qrName').textContent = 'TRAN VAN THONG';
      const amountNum = s.amount ? Number(s.amount) : 0;
      const payload = globalThis.DFRQR.vietQR({
        bankBin: '970407',
        account: '397983',
        name: 'TRAN VAN THONG',
        city: 'HA NOI',
        message: 'DONATE',
        amount: amountNum || undefined,
      });
      const svg = globalThis.DFRQR.toSVG(payload, { size: 240, margin: 4, dark: '#0e9b6c', light: '#ffffff' });
      doc.getElementById('qrFrame').innerHTML = svg;
      doc.getElementById('qrRaw').textContent = payload;
      if (s.amount) {
        const i = doc.getElementById('donateAmount');
        i.value = s.amount;
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }, state);

  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await ctx.close();
  console.log('Saved', outPath);
}

const states = [
  { name: '1-redeem-input', tab: 'redeem', connected: true,
    codes: ['DFREWARD-ABCD-1234', 'DFGIFT-EFGH-5678', 'DFSPECIAL-IJKL-9012', 'DFVIP-MNOP-3456', 'DFNEW-QRST-7890'],
    delay: 3.5 },
  { name: '2-redeem-running', tab: 'redeem', connected: true,
    codes: ['DFREWARD-ABCD-1234', 'DFGIFT-EFGH-5678', 'DFSPECIAL-IJKL-9012', 'DFVIP-MNOP-3456', 'DFNEW-QRST-7890'],
    delay: 3,
    progress: {
      text: '3/5 code', percent: '60%', current: 'Đang đổi DFSPECIAL-IJKL-9012… (mã 3 / 5)',
      stats: [['success', 'Thành công', 2], ['used', 'Đã nhận trước đó', 1], ['pending', 'Đang xử lý', 1], ['pending', 'Còn lại', 1]],
      logs: [
        ['success', 'DFREWARD-ABCD-1234 · Thành công · 2.4s'],
        ['success', 'DFGIFT-EFGH-5678 · Thành công · 2.1s'],
        ['warn', 'DFVIP-MNOP-3456 · Đã nhận trước đó · 2.3s'],
        ['pending', 'DFSPECIAL-IJKL-9012 · Đang xử lý…'],
      ],
    } },
  { name: '3-history', tab: 'history', connected: true,
    history: [
      { id: 'a1b2c3d4', cls: 'ok', when: '25/09/2026 · 17:49:30 → 17:54:30', ago: '(5 phút trước)', parts: [['ok', '8', 'thành công'], ['used', '2', 'đã nhận'], ['bad', '1', 'lỗi'], ['err', '1', 'mạng']] },
      { id: 'b2c3d4e5', cls: 'warn', when: '24/09/2026 · 23:00:00 → 25/09/2026 00:15:30', ago: '(3 giờ trước)', parts: [['ok', '12', 'thành công'], ['used', '3', 'đã nhận']] },
      { id: 'c3d4e5f6', cls: 'bad', when: '23/09/2026 · 09:00:00 → 23/09/2026 09:18:45', ago: '(2 ngày trước)', parts: [['err', '5', 'lỗi mạng']] },
    ] },
  { name: '4-donate', tab: 'donate', connected: true },
  { name: '5-donate-amount', tab: 'donate', connected: true, amount: 50000 },
];

for (const s of states) {
  await shoot(s, `tests/store-${s.name}.png`);
}

await browser.close();
console.log('All screenshots done');
