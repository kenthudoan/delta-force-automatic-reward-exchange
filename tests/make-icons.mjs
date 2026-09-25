// Vẽ icon PNG cho extension từ SVG bằng Chrome headless: `npm run icons`.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { chromePath } from './chrome-path.mjs';

const outDir = fileURLToPath(new URL('../extension/icons/', import.meta.url));

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c2530"/>
      <stop offset="1" stop-color="#0a0f14"/>
    </linearGradient>
    <linearGradient id="box" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3ee0a1"/>
      <stop offset="1" stop-color="#16a874"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)"/>
  <path d="M64 44 C56 26 34 24 36 36 C37.5 45 52 46 64 44 Z" fill="none" stroke="#3ee0a1" stroke-width="8" stroke-linejoin="round"/>
  <path d="M64 44 C72 26 94 24 92 36 C90.5 45 76 46 64 44 Z" fill="none" stroke="#3ee0a1" stroke-width="8" stroke-linejoin="round"/>
  <rect x="24" y="44" width="80" height="20" rx="5" fill="#46eeac"/>
  <rect x="30" y="62" width="68" height="42" rx="6" fill="url(#box)"/>
  <rect x="58" y="44" width="12" height="60" fill="#0a0f14" opacity="0.55"/>
</svg>`;

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
try {
  const page = await browser.newPage();
  await mkdir(outDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`,
    );
    const file = path.join(outDir, `icon-${size}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    console.log('Đã tạo', path.relative(process.cwd(), file));
  }
} finally {
  await browser.close();
}
