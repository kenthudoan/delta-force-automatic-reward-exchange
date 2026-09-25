// Tạo marquee tile (1400×560) + small tile (440×280) cho Chrome Web Store
import { chromium } from 'playwright';

const browser = await chromium.launch();

async function gen(w, h, layout, out) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(layout);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
  await ctx.close();
  console.log('Saved', out);
}

// === MARQUEE TILE: 1400×560 ===
// Bố cục: brand trái + popup mock phải
const marqueeHTML = `
<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px; height: 560px;
    background: linear-gradient(135deg, #ff8c1a 0%, #ff5722 50%, #0e9b6c 100%);
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: white;
    display: grid;
    grid-template-columns: 720px 1fr;
    align-items: center;
    overflow: hidden;
    position: relative;
  }
  /* Decorative shapes */
  body::before {
    content: '';
    position: absolute;
    top: -100px; right: -100px;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -150px; left: -150px;
    width: 500px; height: 500px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .left {
    padding: 0 60px;
    position: relative;
    z-index: 2;
  }
  .badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 24px;
    border: 1px solid rgba(255,255,255,0.2);
  }
  h1 {
    font-size: 56px;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 16px;
    text-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }
  h1 .accent {
    display: block;
    color: #ffd54f;
  }
  .sub {
    font-size: 20px;
    line-height: 1.5;
    opacity: 0.95;
    margin-bottom: 32px;
    max-width: 580px;
  }
  .features {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .chip {
    background: rgba(255,255,255,0.16);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.25);
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
  }
  /* Right popup mock */
  .right {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .popup-mock {
    width: 460px; height: 480px;
    background: white;
    border-radius: 14px;
    box-shadow:
      0 40px 80px rgba(0,0,0,0.30),
      0 20px 40px rgba(0,0,0,0.20),
      0 0 0 1px rgba(0,0,0,0.05);
    transform: rotate(2deg);
    overflow: hidden;
    color: #1f2937;
  }
  .popup-mock .head {
    background: linear-gradient(135deg, #ff8c1a 0%, #ff5722 100%);
    color: white;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .popup-mock .head .icon {
    width: 36px; height: 36px;
    background: rgba(255,255,255,0.25);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px;
  }
  .popup-mock .head .t1 { font-size: 16px; font-weight: 700; }
  .popup-mock .head .t2 { font-size: 12px; opacity: 0.9; }
  .popup-mock .body { padding: 20px; }
  .popup-mock .codes {
    background: #fff8f0;
    border: 2px solid #ff8c1a;
    border-radius: 8px;
    padding: 12px;
    font: 13px/1.6 'Consolas', monospace;
    color: #202124;
    margin-bottom: 12px;
  }
  .popup-mock .codes .line { display: block; }
  .popup-mock .status {
    background: #e6f7f1;
    color: #0a7a55;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .popup-mock .status::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: #0e9b6c;
  }
  .popup-mock .progress {
    margin-bottom: 12px;
  }
  .popup-mock .progress .bar {
    height: 8px;
    background: #f1f3f4;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .popup-mock .progress .fill {
    height: 100%;
    width: 60%;
    background: linear-gradient(90deg, #0e9b6c, #14b890);
    border-radius: 4px;
  }
  .popup-mock .progress .label {
    font-size: 12px;
    color: #5f6368;
    display: flex;
    justify-content: space-between;
  }
  .popup-mock .stats {
    display: flex; gap: 6px;
    flex-wrap: wrap;
  }
  .popup-mock .pill {
    font-size: 11px;
    padding: 5px 10px;
    border-radius: 100px;
    font-weight: 600;
  }
  .pill.ok { background: #e6f7f1; color: #0a7a55; }
  .pill.used { background: #e3f2fd; color: #1565c0; }
  .pill.pending { background: #fff3e0; color: #e65100; }
</style></head><body>
<div class="left">
  <div class="badge">⚡ Auto Redeem Tool</div>
  <h1>Đổi Code Delta Force <span class="accent">hàng loạt, tự động</span></h1>
  <p class="sub">Dán danh sách code, bấm Bắt đầu — extension tự điền vào trang redeem.df.garena.sg, chờ delay bạn chọn, lưu lịch sử, xuất CSV.</p>
  <div class="features">
    <span class="chip">✓ Chạy offline</span>
    <span class="chip">✓ Delay riêng từng code</span>
    <span class="chip">✓ Lưu lịch sử 30 job</span>
    <span class="chip">✓ Xuất CSV</span>
  </div>
</div>
<div class="right">
  <div class="popup-mock">
    <div class="head">
      <div class="icon">DF</div>
      <div>
        <div class="t1">Auto Redeem Code</div>
        <div class="t2">Đã kết nối trang đổi quà</div>
      </div>
    </div>
    <div class="body">
      <div class="codes">
        <span class="line">DFREWARD-ABCD-1234</span>
        <span class="line">DFGIFT-EFGH-5678</span>
        <span class="line">DFSPECIAL-IJKL-9012</span>
        <span class="line">DFVIP-MNOP-3456</span>
        <span class="line">DFNEW-QRST-7890</span>
      </div>
      <div class="status">Đang đổi 3/5 code…</div>
      <div class="progress">
        <div class="bar"><div class="fill"></div></div>
        <div class="label"><span>DFSPECIAL-IJKL-9012</span><strong>60%</strong></div>
      </div>
      <div class="stats">
        <span class="pill ok">✓ 2 thành công</span>
        <span class="pill used">↻ 1 đã nhận</span>
        <span class="pill pending">⏳ 1 đang xử lý</span>
      </div>
    </div>
  </div>
</div>
</body></html>`;

await gen(1400, 560, marqueeHTML, 'tests/store-marquee.png');

// === SMALL TILE: 440×280 ===
const smallHTML = `
<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 440px; height: 280px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: white;
    overflow: hidden;
    position: relative;
    padding: 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  body::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 240px; height: 240px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,140,26,0.4) 0%, transparent 70%);
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -100px; left: -100px;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(14,155,108,0.3) 0%, transparent 70%);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 2;
  }
  .logo {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #ff8c1a 0%, #ff5722 100%);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px;
    box-shadow: 0 4px 12px rgba(255,140,26,0.4);
  }
  .titles { line-height: 1.2; }
  .titles .name {
    font-size: 17px; font-weight: 700;
  }
  .titles .sub {
    font-size: 12px; color: #94a3b8;
  }
  h2 {
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    position: relative;
    z-index: 2;
    text-shadow: 0 2px 12px rgba(0,0,0,0.5);
  }
  h2 .accent {
    color: #ff8c1a;
  }
  .stats {
    display: flex;
    gap: 14px;
    position: relative;
    z-index: 2;
    font-size: 12px;
    color: #cbd5e1;
  }
  .stat .num {
    color: white;
    font-weight: 800;
    font-size: 16px;
    display: block;
    margin-bottom: 2px;
  }
</style></head><body>
  <div class="top">
    <div class="logo">DF</div>
    <div class="titles">
      <div class="name">Auto Redeem Code DF</div>
      <div class="sub">Đổi code Garena tự động</div>
    </div>
  </div>
  <h2>Đổi code <span class="accent">hàng loạt</span><br>không cần ngồi gõ tay</h2>
  <div class="stats">
    <div class="stat"><span class="num">100%</span>Offline</div>
    <div class="stat"><span class="num">30</span>Job lưu lại</div>
    <div class="stat"><span class="num">CSV</span>Xuất nhật ký</div>
  </div>
</body></html>`;

await gen(440, 280, smallHTML, 'tests/store-small.png');

await browser.close();
console.log('Tiles done');
