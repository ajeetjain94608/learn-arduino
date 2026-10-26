// Screenshot any page of the running app: node tools/page-shot.mjs <#/route> <out.png> [width height]
import { chromium } from '@playwright/test';
const [route, out, w = '1280', h = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(`http://localhost:5180/?test${route.startsWith('#') ? route : `#${route}`}`);
await page.reload();
await page.waitForTimeout(3500);
await page.screenshot({ path: out });
await browser.close();
