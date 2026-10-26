// Screenshot a build in the real app (the dev server must be running: npm run dev, port 5180).
//   node tools/preview-build.mjs <build.json | project:<id>> <out.png> [x,y,z,zoom] [--run]
// build.json: { parts: [...], wires: [...], inputs?: {...}, code?: "..." } in the build store's format (see
// src/state/buildStore.ts); "project:night-light" opens that ready-made project instead. With x,y,z,zoom the camera
// looks at that world point (mm) at that zoom (try 3–8 for a close-up of one part). --run compiles and runs the code
// first (to see LEDs lit, servos turned, the OLED drawn).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [file, out, look, flag] = process.argv.slice(2);
if (!file || !out) { console.error('usage: node tools/preview-build.mjs <build.json | project:id> <out.png> [x,y,z,zoom] [--run]'); process.exit(1); }
const projectId = file.startsWith('project:') ? file.slice(8) : null;
const build = projectId ? null : JSON.parse(readFileSync(file, 'utf8'));
const run = [look, flag].includes('--run');
const view = look && look !== '--run' ? look.split(',').map(Number) : null;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5180/?test');
if (projectId) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:5180/?test#/projects/${projectId}`);
  await page.reload();
} else {
  await page.evaluate((b) => localStorage.setItem('rq-build-v1', JSON.stringify({ v: 1, inputs: {}, counters: {}, code: 'void setup() {}\nvoid loop() {}\n', ...b })), build);
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' }).click();
}
await page.getByTestId('viewer').locator('canvas[data-engine]').waitFor();
if (run) {
  await page.getByRole('tab', { name: 'Code' }).click();
  await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
  await page.waitForFunction(() => !/Compiling|Uploading/.test(document.querySelector('[data-testid=status]')?.textContent ?? ''), null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
}
await page.waitForTimeout(1500);
if (view) await page.evaluate(([x, y, z, zoom]) => window.__rq.debug.lookAt(x, y, z, zoom), view);
await page.waitForTimeout(800);
await page.getByTestId('viewer').screenshot({ path: out });
await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(2); }
console.log(`saved ${out}`);
