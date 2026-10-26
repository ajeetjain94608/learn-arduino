// One picture of all the baked project pictures, to check them at a glance: node tools/contact-sheet.mjs <out.png>
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const dir = resolve(process.argv[3] ?? 'src/assets/components');
const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
const html = `<body style="margin:0;background:#E9EDF2;display:grid;grid-template-columns:repeat(4,320px);gap:6px">${files
  .map((f) => `<div style="font:12px sans-serif"><img src="data:image/png;base64,${readFileSync(resolve(dir, f)).toString('base64')}" width="320">${f}</div>`).join('')}</body>`;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 1020 } });
await page.setContent(html);
await page.waitForTimeout(1200);
await page.screenshot({ path: process.argv[2] ?? 'contact.png' });
await browser.close();
