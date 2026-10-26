// Checks a BUILT site (npm run build, then npm run preview / the live URL), not the dev server:
//   node tools/prod-check.mjs <base url>      e.g. http://localhost:4173
// It opens a project, compiles and runs its code in the browser (the WebAssembly compiler must load from the build's
// own paths), and fails on any page error, any failed request, or any request to another website.
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
const origin = new URL(base).origin;
page.on('pageerror', (e) => problems.push(`page error: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text().slice(0, 200)}`); });
page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) problems.push(`other site: ${u}`); });

const step = (s) => console.log(`✓ ${s}`);
await page.goto(`${base}/`);
const title = await page.title();
if (!/Learn Arduino/.test(title)) problems.push(`title is "${title}"`);
step(`home loads: "${title}"`);

for (const path of ['/privacy.html', '/terms.html']) {
  const r = await page.request.get(base + path);
  if (r.status() !== 200) problems.push(`${path}: ${r.status()}`);
}
const missing = await page.request.get(`${base}/avr/toolchain/nope.wasm`);
// (the local preview server answers every unknown path with the app page; the live host must give a real 404)
if (!/localhost|127.0.0.1/.test(base) && missing.status() !== 404) problems.push(`a missing file should be a real 404, got ${missing.status()}`);
step('privacy, terms and real 404s');

await page.goto(`${base}/#/projects/night-light`);
await page.reload();
await page.getByTestId('info-card').getByRole('heading', { name: 'Night light' }).waitFor({ timeout: 20_000 });
await page.locator('[data-hotspot]:visible').first().waitFor({ timeout: 20_000 });
step('a project opens on Home with its labels');

await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
const status = page.getByTestId('status');
await page.waitForFunction(() => !/Compiling|Uploading/.test(document.querySelector('[data-testid=status]')?.textContent ?? ''), null, { timeout: 90_000 });
const text = (await status.textContent()) ?? '';
if (/error|stopped/i.test(text)) problems.push(`after Run the status says "${text}"`);
await page.waitForTimeout(2500);
const serial = await page.getByRole('log', { name: 'Serial monitor' }).innerText();
if (!/light \d+/.test(serial)) problems.push(`no readings in the serial monitor: ${JSON.stringify(serial.slice(0, 80))}`);
step(`compiled in the browser and ran: serial shows ${JSON.stringify(serial.trim().split('\n').slice(-2))}`);

await page.goto(`${base}/#/build`);
await page.reload();
await page.getByRole('tab', { name: 'Parts' }).waitFor({ timeout: 20_000 });
step('Build opens');

await browser.close();
if (problems.length) { console.error('\nPROBLEMS:\n' + [...new Set(problems)].join('\n')); process.exit(1); }
console.log('\nall good: no errors, no failed requests, nothing fetched from another site');
