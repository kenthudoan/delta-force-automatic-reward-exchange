// Tìm Chrome đã cài trên máy (có thể ghi đè bằng biến môi trường CHROME_PATH).
import { existsSync } from 'node:fs';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (CANDIDATES[process.platform] || []).find((p) => existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome. Đặt biến môi trường CHROME_PATH trỏ tới file chạy Chrome.');
  return found;
}
