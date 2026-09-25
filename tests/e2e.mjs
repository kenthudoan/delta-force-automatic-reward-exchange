// Kiểm thử end-to-end: `npm run test:e2e` (mất khoảng 2–3 phút).
//
// Chạy extension thật trong Chrome, trên mã nguồn THẬT của trang đổi quà (HTML/JS/CSS
// được tải trực tiếp từ redeem.df.garena.sg), nhưng API đổi code được thay bằng máy chủ
// giả chạy trên máy này. Không có request đổi code nào tới Garena, không cần tài khoản,
// cookie đăng nhập là giả. Nếu Garena đổi giao diện trang, test này sẽ báo lỗi.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromePath } from './chrome-path.mjs';

const EXTENSION_DIR = fileURLToPath(new URL('../extension/', import.meta.url));
const SHOTS_DIR = process.env.SHOTS_DIR || '';
const PAGE_URL = 'https://redeem.df.garena.sg/vi/cdkgarena.html';
const API_HOST = 'sg-act.playerinfinite.com';
const API_PATH = '/api/proxy/present/CdkV2/RedeemCDKey';
const JOB_KEY = 'dfr.job';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------------ máy chủ giả

const apiCalls = []; // mọi request đổi code mà trang đã gửi: { cdkey, t }

/** Kết quả giả theo tiền tố của code. */
function mockRedeem(cdkey) {
  const nth = apiCalls.filter((call) => call.cdkey === cdkey).length;
  if (cdkey.startsWith('OK')) return { status: 200, body: { code: 0, msg: 'ok', data: {} } };
  if (cdkey.startsWith('USED')) return { status: 200, body: { code: 400072, msg: 'already redeemed' } };
  if (cdkey.startsWith('BAD')) return { status: 200, body: { code: 400054, msg: 'invalid' } };
  if (cdkey.startsWith('EXP')) return { status: 200, body: { code: 400070, msg: 'expired' } };
  if (cdkey.startsWith('WEIRD')) return { status: 200, body: { code: 601008, msg: 'mystery' } };
  if (cdkey.startsWith('SESS')) return { status: 200, body: { code: 300001, msg: 'login expired' } };
  if (cdkey.startsWith('FLAKY')) return nth === 1 ? { status: 502, body: 'bad gateway' } : { status: 200, body: { code: 0 } };
  if (cdkey.startsWith('DOWN')) return { status: 502, body: 'bad gateway' };
  return { status: 200, body: { code: 400054, msg: 'invalid' } };
}

function makeCertificate(dir) {
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=df-redeem-e2e',
    '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'),
  ], { stdio: 'ignore' });
  return { key: readFileSync(path.join(dir, 'key.pem')), cert: readFileSync(path.join(dir, 'cert.pem')) };
}

const upstream = new Map();
function fetchUpstream(url) {
  if (!upstream.has(url)) {
    upstream.set(url, (async () => {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (df-redeem-extension e2e test)' } });
      return {
        status: res.status,
        type: res.headers.get('content-type') || 'application/octet-stream',
        body: Buffer.from(await res.arrayBuffer()),
      };
    })());
  }
  return upstream.get(url);
}

/** Chỉ tải file tĩnh của trang đổi quà và SDK đăng nhập; mọi thứ khác (analytics...) bị chặn. */
function isStaticAsset(host, pathname) {
  return host === 'redeem.df.garena.sg' || (host === 'sg-gpts.playerinfinite.com' && pathname.startsWith('/comm/assets/'));
}

function cors(req) {
  return {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || 'content-type',
  };
}

const apiTraffic = []; // DEBUG: mọi request tới host API (kể cả OPTIONS)

async function handleRequest(req, res) {
  req.resume();
  const host = (req.headers.host || '').split(':')[0];
  const url = new URL(req.url, `https://${host}`);
  if (host === API_HOST) apiTraffic.push(`${new Date().toISOString().slice(14, 23)} ${req.method} ${url.searchParams.get('cdkey')}`);
  try {
    if (host === API_HOST && req.method === 'OPTIONS') {
      res.writeHead(204, cors(req)).end();
    } else if (host === API_HOST && req.method === 'POST' && url.pathname === API_PATH) {
      const cdkey = url.searchParams.get('cdkey') || '';
      apiCalls.push({ cdkey, t: Date.now() });
      const reply = mockRedeem(cdkey);
      const isText = typeof reply.body === 'string';
      res.writeHead(reply.status, { ...cors(req), 'content-type': isText ? 'text/plain' : 'application/json' });
      res.end(isText ? reply.body : JSON.stringify(reply.body));
    } else if (req.method === 'GET' && isStaticAsset(host, url.pathname)) {
      const file = await fetchUpstream(`https://${host}${url.pathname}${url.search}`);
      res.writeHead(file.status, { 'content-type': file.type }).end(file.body);
    } else {
      res.writeHead(404, cors(req)).end();
    }
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
}

// ------------------------------------------------------------------ tiện ích test

let passed = 0;
let stepStarted = 0;
const mark = (label) => {
  if (process.env.DEBUG) console.log(`\n    [${((Date.now() - stepStarted) / 1000).toFixed(1)}s] ${label}`);
};
async function step(name, fn) {
  const started = Date.now();
  stepStarted = started;
  process.stdout.write(`• ${name} … `);
  await fn();
  passed += 1;
  console.log(`✔ (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

async function waitUntil(fn, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(250);
  }
  throw new Error(`Hết thời gian chờ: ${label}`);
}

// ------------------------------------------------------------------ chạy

const tmp = mkdtempSync(path.join(os.tmpdir(), 'df-redeem-e2e-'));
const server = https.createServer(makeCertificate(tmp), handleRequest);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: process.env.HEADFUL ? false : true,
  pipe: true,
  enableExtensions: [EXTENSION_DIR],
  acceptInsecureCerts: true,
  userDataDir: path.join(tmp, 'profile'),
  args: [
    `--host-resolver-rules=MAP * 127.0.0.1:${port}`,
    '--ignore-certificate-errors',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

let exitCode = 0;
try {
  const worker = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'),
    { timeout: 15000 },
  );
  const extensionId = new URL(worker.url()).host;
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log(`Extension id: ${extensionId}\n`);

  const pageErrors = [];
  const garena = await browser.newPage({ type: 'window', windowBounds: { width: 1200, height: 800 } });
  garena.on('console', (msg) => {
    if (msg.type() === 'error' && /chrome-extension:|dfr/i.test(`${msg.text()} ${msg.location()?.url || ''}`)) {
      pageErrors.push(msg.text());
    }
  });
  garena.on('pageerror', (error) => {
    if (/chrome-extension:/.test(error.stack || '')) pageErrors.push(error.message);
  });

  let popup = await browser.newPage({ type: 'window', windowBounds: { width: 420, height: 900 } });
  const openPopup = async () => {
    await popup.setViewport({ width: 380, height: 860 });
    await popup.goto(popupUrl);
  };
  const readJob = () => popup.evaluate(async (key) => (await chrome.storage.local.get(key))[key] || null, JOB_KEY);
  const waitJob = (pred, label, timeoutMs = 90000) => waitUntil(async () => {
    const job = await readJob();
    return job && pred(job) ? job : null;
  }, timeoutMs, label);
  const popupText = (selector) => popup.$eval(selector, (el) => el.textContent.trim());
  const setCodes = (text) => popup.$eval('#codes', (el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  const clickVisible = async (selector) => {
    await popup.waitForSelector(`${selector}:not([hidden]):not([disabled])`, { timeout: 10000 });
    await popup.click(selector);
  };
  const resetJob = async () => {
    await clickVisible('#reset');
    await popup.click('#reset');
    await waitUntil(async () => !(await readJob()), 5000, 'xóa tiến trình');
  };
  const shot = async (name) => {
    if (!SHOTS_DIR) return;
    for (const scheme of ['dark', 'light']) {
      await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await popup.screenshot({ path: path.join(SHOTS_DIR, `${name}-${scheme}.png`), fullPage: true });
    }
    await popup.emulateMediaFeatures([]);
  };
  const buttonsShown = () => popup.$$eval('.actions .btn:not([hidden])', (els) => els.map((b) => b.id));
  const itemsOf = (job) => Object.fromEntries(job.items.map((it) => [it.code, it]));

  await garena.goto(PAGE_URL, { waitUntil: 'networkidle2' });
  await openPopup();

  await step('Trang chưa đăng nhập: popup báo và không gửi request nào', async () => {
    await garena.waitForSelector('.state-before.show', { timeout: 15000 });
    await waitUntil(async () => (await popupText('#pageStatusText')).includes('chưa đăng nhập'), 10000, 'trạng thái chưa đăng nhập');
    await setCodes('OKCODE000');
    await clickVisible('#start');
    await waitUntil(async () => (await popupText('#flash')).includes('chưa đăng nhập'), 5000, 'thông báo lỗi');
    assert.equal(apiCalls.length, 0);
    assert.equal(await readJob(), null);
  });

  await browser.setCookie({
    name: 'user_info',
    value: encodeURIComponent(JSON.stringify({ openid: 'e2e-openid', token: 'e2e-token', user_name: 'E2E' })),
    domain: 'redeem.df.garena.sg',
    path: '/',
    secure: true,
  });
  await garena.reload({ waitUntil: 'networkidle2' });

  await step('Đăng nhập (cookie giả): trang hiện ô nhập code, popup báo đã kết nối', async () => {
    await garena.waitForSelector('.state-after.show .exc-input', { timeout: 15000 });
    await waitUntil(async () => (await popupText('#pageStatusText')).includes('đã đăng nhập'), 10000, 'trạng thái đăng nhập');
  });

  await step('Nhận diện code: bỏ từ thừa, cảnh báo ký tự Nga', async () => {
    await setCodes('Code Delta: OKCODE001, USEDCODE01; BADCODE001 | EXPCODE001\nFLAKYCODE1 WEIRDCODE1\r\nOKCODE002\nG3\nDFAXIOм33\nOKCODE001');
    assert.match(await popupText('#parseCount'), /^7 code/);
    assert.match(await popupText('#parseNotes'), /Bỏ 1 code trùng.*Bỏ qua 3 từ.*Code, Delta, G3/);
    assert.match(await popupText('#suspiciousList'), /DFAXIOм33\s*→\s*DFAXIOM33/);
    await popup.$eval('#delay', (el) => {
      el.value = '3';
      el.dispatchEvent(new Event('input'));
      el.dispatchEvent(new Event('change'));
    });
    assert.equal(await popupText('#delayOut'), '3,0 giây');
  });

  const hookEvents = [];
  await garena.exposeFunction('__e2eHook', (detail) => hookEvents.push(detail));
  await garena.evaluate(() => document.addEventListener('dfr:redeem-result', (e) => window.__e2eHook(e.detail)));

  await step('Đổi 7 code: kết quả đúng từng loại, tự thử lại khi lỗi mạng, đóng popup vẫn chạy', async () => {
    await clickVisible('#start');
    await waitJob((job) => job.items.filter((it) => it.status !== 'pending').length >= 2, 'xong 2 code đầu');
    await shot('popup-running');
    // Đóng popup giữa chừng: tiến trình phải tiếp tục trong tab đổi quà.
    const doneBefore = (await readJob()).items.filter((it) => it.status !== 'pending').length;
    await popup.close();
    await sleep(9000);
    popup = await browser.newPage({ type: 'window', windowBounds: { width: 420, height: 900 } });
    await openPopup();
    const doneAfter = (await readJob()).items.filter((it) => it.status !== 'pending').length;
    assert.ok(doneAfter > doneBefore, `đóng popup thì tiến trình dừng (${doneBefore} → ${doneAfter})`);

    const job = await waitJob((j) => j.status === 'done', 'hoàn tất 7 code');
    await waitUntil(async () => (await buttonsShown()).join() === 'start,retry,reset', 1000, 'nút sau khi hoàn tất');
    const items = itemsOf(job);
    assert.deepEqual(
      Object.fromEntries(Object.entries(items).map(([code, it]) => [code, `${it.status}/${it.attempts}`])),
      {
        OKCODE001: 'success/1', USEDCODE01: 'used/1', BADCODE001: 'invalid/1', EXPCODE001: 'invalid/1',
        FLAKYCODE1: 'success/2', WEIRDCODE1: 'error/1', OKCODE002: 'success/1',
      },
    );
    assert.equal(items.EXPCODE001.message, 'Code đã hết hạn.');
    assert.match(items.WEIRDCODE1.message, /601008: mystery/);
    assert.deepEqual(apiCalls.map((c) => c.cdkey), [
      'OKCODE001', 'USEDCODE01', 'BADCODE001', 'EXPCODE001', 'FLAKYCODE1', 'FLAKYCODE1', 'WEIRDCODE1', 'OKCODE002',
    ]);
    for (let i = 1; i < apiCalls.length; i += 1) {
      const gap = apiCalls[i].t - apiCalls[i - 1].t;
      const min = apiCalls[i].cdkey === apiCalls[i - 1].cdkey ? 5900 : 2900; // thử lại thì chờ gấp đôi
      assert.ok(gap >= min, `khoảng cách giữa 2 request quá ngắn: ${gap}ms`);
    }
    assert.equal(await garena.$eval('#diaTips', (el) => getComputedStyle(el).display), 'none', 'hộp thoại chưa đóng');
    assert.equal(await garena.$eval('.exc-input', (el) => el.value), '', 'ô nhập chưa được xóa');
    assert.equal(await popup.$eval('#codes', (el) => el.value), 'DFAXIOм33', 'code chưa gửi phải được giữ lại');
    assert.match(await popupText('#stats'), /Thành công 3.*Đã nhận trước đó 1.*Không dùng được 2.*Lỗi 1.*Còn lại 0/);
    await shot('popup-done');
  });

  await step('Sự kiện từ page-hook chỉ chứa phase/cdkey/httpStatus/code/msg (không lộ token)', async () => {
    const allowed = new Set(['phase', 'cdkey', 'httpStatus', 'code', 'msg']);
    const events = hookEvents.map((raw) => JSON.parse(raw));
    assert.equal(events.filter((e) => e.phase === 'done').length, 8);
    assert.equal(events.filter((e) => e.phase === 'sent').length, 8);
    for (const event of events) {
      assert.ok(Object.keys(event).every((key) => allowed.has(key)), JSON.stringify(event));
    }
    assert.ok(!hookEvents.some((raw) => raw.includes('e2e-token') || raw.includes('e2e-openid')));
  });

  await step('Tạm dừng / tiếp tục / tải lại trang giữa chừng', async () => {
    await resetJob();
    apiCalls.length = 0;
    await setCodes('OKCODE101 BADCODE101 OKCODE102 USEDCODE102');
    apiTraffic.length = 0;
    await clickVisible('#start');
    mark('đã bấm Bắt đầu');
    const first = await waitJob((job) => job.items[0].status !== 'pending', 'xong code đầu');
    mark(`xong code đầu. Nhật ký: ${JSON.stringify(first.logs.map((l) => `${new Date(l.t).toISOString().slice(14, 23)} ${l.code} ${l.text}`))}`);
    mark(`Request tới API: ${JSON.stringify(apiTraffic)}`);
    await clickVisible('#pause');
    let job = await waitJob((j) => j.status === 'paused', 'tạm dừng');
    await waitUntil(async () => (await buttonsShown()).join() === 'resume,reset', 1000, 'nút sau khi tạm dừng');
    assert.equal(job.items.filter((it) => it.status === 'pending').length, 3);
    await sleep(4000);
    assert.equal(apiCalls.length, 1, 'đang tạm dừng mà vẫn gửi request');

    await clickVisible('#resume');
    mark('đã bấm Tiếp tục');
    await waitJob((j) => j.items[1].status !== 'pending' && j.current && j.current.phase === 'waiting', 'xong code thứ 2');
    mark('xong code thứ 2, tải lại trang');
    await garena.reload({ waitUntil: 'networkidle2' });
    mark('trang đã tải lại');
    job = await waitJob((j) => j.status === 'paused', 'tạm dừng sau khi tải lại trang');
    assert.match(job.logs.at(-1).text, /tải lại/);
    await garena.waitForSelector('.state-after.show', { timeout: 15000 });
    mark('trang đã đăng nhập');
    await sleep(1500); // chờ popup cập nhật kết nối với content script mới
    await clickVisible('#resume');
    mark('đã bấm Tiếp tục lần 2');
    job = await waitJob((j) => j.status === 'done', 'hoàn tất sau khi tiếp tục');
    mark(`hoàn tất: ${JSON.stringify(job.logs.slice(-6).map((l) => `${l.code} ${l.text}`))}`);
    assert.deepEqual(job.items.map((it) => `${it.status}/${it.attempts}`), ['success/1', 'invalid/1', 'success/1', 'used/1']);
    assert.deepEqual(apiCalls.map((c) => c.cdkey), ['OKCODE101', 'BADCODE101', 'OKCODE102', 'USEDCODE102']);
  });

  await step('Trang bỏ qua cú bấm "Đổi": sau 5 giây báo lỗi và tự thử lại', async () => {
    await resetJob();
    apiCalls.length = 0;
    // Giả lập trang phớt lờ cú bấm đầu tiên (không gửi request nào).
    await garena.evaluate(() => {
      let swallowed = false;
      document.addEventListener('click', (event) => {
        if (!swallowed && event.target.closest('.btn-exchange')) {
          swallowed = true;
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      }, true);
    });
    await setCodes('OKCODE401');
    await clickVisible('#start');
    const job = await waitJob((j) => j.status === 'done', 'hoàn tất sau khi thử lại', 30000);
    assert.equal(`${job.items[0].status}/${job.items[0].attempts}`, 'success/2');
    assert.ok(job.logs.some((l) => /Trang chưa gửi yêu cầu đổi code/.test(l.text)));
    assert.deepEqual(apiCalls.map((c) => c.cdkey), ['OKCODE401']);
  });

  await step('Hết phiên đăng nhập (300001): tự tạm dừng, code vẫn chờ đổi', async () => {
    await resetJob();
    await setCodes('SESSCODE01 OKCODE201');
    await clickVisible('#start');
    const job = await waitJob((j) => j.status === 'paused', 'tạm dừng vì hết phiên');
    assert.match(job.pauseReason, /Phiên đăng nhập đã hết hạn/);
    assert.equal(job.items[0].status, 'pending');
    assert.equal(job.items[0].attempts, 0);
    assert.equal(job.items[1].status, 'pending');
    // Trang có thể chuyển hướng để đăng nhập lại: mở lại trang đổi quà.
    await garena.goto(PAGE_URL, { waitUntil: 'networkidle2' });
    await garena.waitForSelector('.state-after.show', { timeout: 15000 });
  });

  await step('Lỗi mạng liên tục: thử lại 3 lần rồi tự tạm dừng để tránh bị chặn', async () => {
    await resetJob();
    apiCalls.length = 0;
    await setCodes('DOWNCODE01 DOWNCODE02 OKCODE301');
    await clickVisible('#start');
    const job = await waitJob((j) => j.status === 'paused', 'tự tạm dừng vì lỗi mạng', 120000);
    assert.match(job.pauseReason, /Lỗi mạng nhiều lần liên tiếp/);
    const items = itemsOf(job);
    assert.equal(`${items.DOWNCODE01.status}/${items.DOWNCODE01.attempts}`, 'network/3');
    assert.equal(`${items.DOWNCODE02.status}/${items.DOWNCODE02.attempts}`, 'pending/2');
    assert.equal(items.OKCODE301.status, 'pending');
    assert.equal(apiCalls.length, 5);
    await shot('popup-paused');
  });

  await step('Mã lạ 3 lần liên tiếp: tự tạm dừng; "Thử lại code lỗi" chạy lại đúng các code đó', async () => {
    await resetJob();
    apiCalls.length = 0;
    await setCodes('WEIRDCODE2 WEIRDCODE3 WEIRDCODE4 OKCODE501');
    await clickVisible('#start');
    let job = await waitJob((j) => j.status === 'paused', 'tự tạm dừng vì mã lạ', 30000);
    assert.match(job.pauseReason, /mã lạ 3 lần liên tiếp/);
    assert.deepEqual(job.items.map((it) => it.status), ['error', 'error', 'error', 'pending']);
    await clickVisible('#resume');
    job = await waitJob((j) => j.status === 'done', 'hoàn tất code còn lại', 30000);
    assert.equal(job.items[3].status, 'success');
    const doneId = job.id;
    await clickVisible('#retry');
    // Hết code sau 3 lần mã lạ nên lượt thử lại kết thúc "Hoàn tất" (không còn gì để tạm dừng).
    job = await waitJob((j) => j.id !== doneId && j.status === 'done', 'thử lại các code lỗi', 30000);
    assert.deepEqual(job.items.map((it) => `${it.code}:${it.status}`), ['WEIRDCODE2:error', 'WEIRDCODE3:error', 'WEIRDCODE4:error']);
  });

  await step('Không có lỗi JavaScript từ extension trên trang', async () => {
    assert.deepEqual(pageErrors, []);
  });

  console.log(`\nTất cả ${passed} bước đều đạt.`);
} catch (error) {
  exitCode = 1;
  console.log('✘');
  console.error(`\n${error.stack || error}`);
} finally {
  await browser.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);
