// Takes the tutorials' pictures from our own 3D lab (so every picture is ours: no copyright worries) into content/learn/img:
// the 3D scene of a project, close-ups, the wiring schematic, and a 1200 × 630 share card for each article.
//   npm run dev            (in another terminal: the lab at http://localhost:5180)
//   node tools/learn/shoot.mjs [only-this-file-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.LAB_URL ?? 'http://localhost:5180';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = path.join(ROOT, 'content/learn/img');
const only = process.argv[2];

// What to take. scene: the 3D view alone (labels kept, controls hidden). schematic: the Wiring tab's drawing. card: the share card.
// look: [x, z, zoom] to point the camera somewhere before the picture.
export const SHOTS = [
  { file: 'blink-hero.jpg', scene: '#/projects/blink' },
  { file: 'blink-close.jpg', scene: '#/projects/blink', look: [40, 6, 3.6], labels: false },
  { file: 'blink-schematic.png', schematic: '#/projects/blink/build' },
  { file: 'blink-og.jpg', card: { title: 'Blink an LED', sub: 'Your first Arduino circuit — explained, and live in 3D', image: 'blink-hero.jpg' } },
  { file: 'distance-hero.jpg', scene: '#/projects/distance' },
  { file: 'distance-close.jpg', scene: '#/projects/distance', look: [150, 5, 3], labels: false },
  { file: 'distance-schematic.png', schematic: '#/projects/distance/build' },
  { file: 'distance-og.jpg', card: { title: 'Measure distance with the HC-SR04', sub: 'How ultrasound echoes become centimetres — live in 3D', image: 'distance-hero.jpg' } },
  { file: 'breadboard-hero.jpg', scene: '#/projects/button', look: [50, 8, 2.6], labels: false },
  { file: 'breadboard-blink.jpg', scene: '#/projects/knob', look: [50, 8, 2.8] },
  { file: 'breadboard-og.jpg', card: { title: 'What is a breadboard?', sub: 'How the holes are joined inside — and how to use one', image: 'breadboard-hero.jpg' } },
];

const HIDE = '.viewer-toolbar, .viewer-corner, .status, .embed-bar, .gl-guard { visibility: hidden !important; }';

async function scene(page, s) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/?test&embed${s.scene}`);
  await page.waitForFunction(() => window.__rq?.debug?.lookAt, null, { timeout: 30_000 });
  await page.addStyleTag({ content: HIDE + (s.labels === false ? '.overlay { visibility: hidden !important; }' : '') });
  if (s.look) await page.evaluate(([x, z, zoom]) => window.__rq.debug.lookAt(x, 0, z, zoom), s.look);
  await page.waitForTimeout(2600); // the camera settles, textures arrive
  await page.screenshot({ path: path.join(OUT, s.file), type: 'jpeg', quality: 82 });
}

async function schematic(page, s) {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`${BASE}/?test${s.schematic}`);
  await page.getByRole('tab', { name: 'Wiring' }).click();
  const el = page.getByTestId('schematic');
  await el.waitFor();
  await page.waitForTimeout(400);
  await el.screenshot({ path: path.join(OUT, s.file) });
}

async function card(page, s) {
  const img = fs.readFileSync(path.join(OUT, s.card.image)).toString('base64');
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')).toString('base64');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: N; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 1000; }
    body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: N, sans-serif; background: #0E2A33; color: #fff; position: relative; }
    .pic { position: absolute; inset: 0 0 0 420px; background: url(data:image/jpeg;base64,${img}) center / cover; }
    .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #0E2A33 36%, rgba(14,42,51,.85) 46%, rgba(14,42,51,0) 70%); }
    .txt { position: absolute; left: 64px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
    .k { color: #5BD6DE; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; font-size: 22px; }
    h1 { font-size: 64px; line-height: 1.05; margin: 14px 0 18px; font-weight: 900; }
    p { font-size: 26px; line-height: 1.35; margin: 0; color: #CFE6EA; }
    .b { position: absolute; left: 64px; bottom: 44px; font-weight: 900; font-size: 24px; letter-spacing: .06em; }
    .b span { color: #5BD6DE; }
    .play { position: absolute; right: 64px; bottom: 44px; background: #0E7C86; border-radius: 999px; padding: 14px 26px; font-weight: 900; font-size: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  </style></head><body><div class="pic"></div><div class="fade"></div>
    <div class="txt"><div class="k">Free Arduino tutorial</div><h1>${s.card.title}</h1><p>${s.card.sub}</p></div>
    <div class="b">LEARN <span>ARDUINO</span> · learnarduino.tech</div><div class="play">▶ Try it in 3D</div></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, s.file), type: 'jpeg', quality: 86 });
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const s of SHOTS) {
  if (only && !s.file.startsWith(only)) continue;
  if (s.scene) await scene(page, s); else if (s.schematic) await schematic(page, s); else await card(page, s);
  console.log('✓', s.file);
}
await browser.close();
