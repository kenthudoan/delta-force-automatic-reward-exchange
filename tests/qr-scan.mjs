// Generate actual SVG from QR and decode with jsQR to verify it scans
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const QR = (await import('jsqr')).default;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 800 } });

  page.on('console', (msg) => console.log('[browser]', msg.text()));
  page.on('pageerror', (err) => console.log('[error]', err.message));

  await page.goto('file:///C:/Users/Admin/Downloads/delta-force-automatic-reward-exchange/extension/popup.html');

  // Wait for scripts to load
  await page.waitForFunction(() => globalThis.DFRQR && globalThis.qrcode, { timeout: 5000 });

  // Switch to donate tab
  await page.evaluate(() => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    const t = document.querySelector('[data-tab="donate"]');
    t.classList.add('active');
    t.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = true; });
    document.getElementById('tab-donate').hidden = false;
  });

  // Generate QR
  const svg = await page.evaluate(() => {
    try {
      return globalThis.DFRQR.toSVG(globalThis.DFRQR.vietQR({
        bankBin: '970407',
        account: '397983',
        name: 'TRAN VAN THONG',
        city: 'HA NOI',
        amount: 100000,
        message: 'UNG HO TAC GIA',
        dynamic: false,
      }), { size: 240, ecc: 'M' });
    } catch (e) {
      return 'ERROR: ' + e.message;
    }
  });

  if (svg.startsWith('ERROR')) {
    console.log(svg);
    await browser.close();
    process.exit(1);
  }

  console.log('SVG generated, length:', svg.length);

  // Save SVG as PNG (use page screenshot of inline svg)
  await page.evaluate((svgStr) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;background:white;padding:20px;';
    div.innerHTML = svgStr;
    document.body.appendChild(div);
    window.__qrContainer = div;
  }, svg);

  await page.waitForTimeout(200);
  const el = await page.$('window.__qrContainer > svg');
  const qrContainer = await page.evaluateHandle(() => window.__qrContainer);
  const svgEl = await qrContainer.asElement().$('svg');
  await svgEl.screenshot({ path: 'tests/qr-generated.png' });

  // Decode the screenshot using jsQR via canvas
  const decoded = await page.evaluate(async () => {
    const img = window.__qrContainer.querySelector('svg');
    const xml = new XMLSerializer().serializeToString(img);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const im = new Image();
    await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = url; });
    const c = document.createElement('canvas');
    c.width = im.width || 280; c.height = im.height || 280;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(im, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    return { width: c.width, height: c.height, data: Array.from(id.data) };
  });

  console.log('Image data ready, w=' + decoded.width + ' h=' + decoded.height);

  // Decode with jsQR (offline)
  const result = QR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
  if (result) {
    console.log('✓ QR DECODED:', result.data);
  } else {
    console.log('✗ QR FAILED TO DECODE — save raw screenshot');
    fs.writeFileSync('tests/qr-fail.png', Buffer.from(decoded.data));
  }

  await browser.close();
})();
