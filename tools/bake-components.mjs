// Bakes a picture of every component on its own to src/assets/components/<id>.png (transparent, tightly cropped), from the
// real 3D scene with only that part drawn (?solo): no UNO, breadboard, wires or props. Project cards and the Components page
// show these, like the UNO and LED cards always did.
// Usage: npm run dev (another terminal), then: npm run bake:components [id …]   (no ids = all)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const all = [...readFileSync('src/content/components.ts', 'utf8').matchAll(/^ {2}([a-z0-9]+): \{\s*$/gm)].map((m) => m[1]);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
mkdirSync('src/assets/components', { recursive: true });
const SRC_W = 1100, SRC_H = 770, OUT_W = 480, OUT_H = 336, PAD = 0.14; // render big, then crop to the content at the card's shape

const browser = await chromium.launch({ channel: 'chrome' });
const cropper = await browser.newPage();
await cropper.setContent('<canvas id="c"></canvas>');
// the picture's visible (non-transparent) box, fitted into OUT_W × OUT_H with a little padding
const crop = (b64) => cropper.evaluate(async ([b64, OUT_W, OUT_H, PAD]) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let w = (x1 - x0 + 1) * (1 + PAD * 2), h = (y1 - y0 + 1) * (1 + PAD * 2);
  if (w / h > OUT_W / OUT_H) h = w * OUT_H / OUT_W; else w = h * OUT_W / OUT_H;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
  const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  o.drawImage(c, cx - w / 2, cy - h / 2, w, h, 0, 0, OUT_W, OUT_H);
  return out.toDataURL('image/png').split(',')[1];
}, [b64, OUT_W, OUT_H, PAD]);

let failed = 0;
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: SRC_W, height: SRC_H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5180/?test&thumb');
  await page.evaluate(() => localStorage.clear());
  const solo = id === 'uno' || id === 'breadboard' ? id : 'part';
  await page.goto(`http://localhost:5180/?test&thumb&solo=${solo}#/components/${id}`);
  await page.reload();
  const viewer = page.getByTestId('viewer');
  await viewer.locator('canvas[data-engine]').waitFor();
  await page.addStyleTag({ content: `
    html, body, #root, .app { background: transparent !important; }
    [data-testid=viewer] { position: fixed !important; inset: 0 !important; width: ${SRC_W}px !important; height: ${SRC_H}px !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: transparent !important; }
    [data-testid=viewer] > :not(:first-child) { display: none !important; }
    .app > :not([data-testid=viewer]) { display: none !important; }` });
  await page.waitForTimeout(2500); // the build is on the bench and the canvas has its new size
  await page.evaluate(() => window.__rq.debug.frameAll(0.02));
  await page.waitForTimeout(1200);
  const shot = await viewer.screenshot({ omitBackground: true });
  writeFileSync(`src/assets/components/${id}.png`, Buffer.from(await crop(shot.toString('base64')), 'base64'));
  if (errors.length) { failed++; console.error(`${id}: page errors\n${errors.join('\n')}`); } else console.log(`wrote src/assets/components/${id}.png`);
  await page.close();
}
await browser.close();
if (failed) process.exit(2);
