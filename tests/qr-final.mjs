// Test QR với nhiều test case + so với QR chuẩn VietQR.io
import { chromium } from 'playwright';
import QR from 'jsqr';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///C:/Users/Admin/Downloads/delta-force-automatic-reward-exchange/extension/popup.html');
await page.waitForFunction(() => globalThis.DFRQR);

// Các test case để bao phủ edge cases
const cases = [
  { name: 'TCB 397983 100k QRIBFTTA (chuẩn)',
    opts: { bankBin: '970407', account: '397983', name: 'TRAN VAN THONG', city: 'HA NOI', amount: 100000, message: 'UNG HO TAC GIA', service: 'QRIBFTTA' } },
  { name: 'VCB tĩnh (không amount)',
    opts: { bankBin: '970436', account: '9999888877', name: 'NGUYEN VAN A', city: 'HA NOI', amount: 0, service: 'QRIBFTTA' } },
  { name: 'TCB tĩnh amount linh hoạt (thực tế)',
    opts: { bankBin: '970407', account: '397983', name: 'TRAN VAN THONG', city: 'HA NOI', service: 'QRIBFTTA' } },
];

for (const { name, opts } of cases) {
  const result = await page.evaluate(async (opts) => {
    // Sửa: thiếu default service sẽ gây undefined → đã set default 'QRIBFTTA' trong qr.js
    const tlv = globalThis.DFRQR.vietQR(opts);
    const svg = globalThis.DFRQR.toSVG(tlv, { size: 240, margin: 4 });
    const div = document.createElement('div');
    div.innerHTML = svg;
    document.body.appendChild(div);
    const img = div.querySelector('svg');
    const xml = new XMLSerializer().serializeToString(img);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const im = new Image();
    await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = url; });
    const c = document.createElement('canvas');
    c.width = 280; c.height = 280;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 280, 280);
    ctx.drawImage(im, 0, 0);
    const id = ctx.getImageData(0, 0, 280, 280);
    document.body.removeChild(div);
    return { tlv, data: Array.from(id.data) };
  }, opts);

  const decoded = QR(new Uint8ClampedArray(result.data), 280, 280);
  console.log(`\n=== ${name} ===`);
  console.log('TLV:', result.tlv);
  if (decoded) {
    console.log('✓ Decode:', decoded.data);
  } else {
    console.log('✗ Failed');
  }
}

await browser.close();
