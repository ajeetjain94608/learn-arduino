// Screenshot any page of the running app: node tools/page-shot.mjs <#/route> <out.png> [width height] [extra query like anim] [waitMs]
// (the wait is how long after loading: with "anim", try 900 to catch the circuit half built)
import { chromium } from '@playwright/test';
const [route, out, w = '1280', h = '800', query = '', wait = '3500'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(`http://localhost:5180/?test${query ? `&${query}` : ''}${route.startsWith('#') ? route : `#${route}`}`);
await page.reload();
await page.waitForTimeout(Number(wait));
console.log(await page.evaluate(() => location.href + ' | ' + document.querySelector('[data-testid=info-card] h2')?.textContent));
await page.screenshot({ path: out });
await browser.close();
