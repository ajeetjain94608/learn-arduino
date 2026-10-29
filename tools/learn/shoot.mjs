// Takes every tutorial picture from our own 3D lab (so every picture is ours: no copyright worries) into content/learn/img:
//   <project>-hero.jpg       the whole circuit, clear and complete (the top of a project tutorial)
//   <project>-close.jpg      a close-up of its main part (inside the tutorial)
//   <project>-schematic.png  the Wiring tab's schematic drawing
//   <type>-3d.jpg            a component on its own (the top of a component tutorial)
//   <og>                     each article's 1200 × 630 share card (its own name, from the article's front matter)
//   npm run dev                                (another terminal: the lab at http://localhost:5180)
//   node tools/learn/shoot.mjs [only files starting with this]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { loadArticles } from './build.mjs';

const BASE = process.env.LAB_URL ?? 'http://localhost:5180';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = path.join(ROOT, 'content/learn/img');
const only = process.argv[2];

const PROJECTS = ['board', 'blink', 'button', 'knob', 'rgb', 'night-light', 'distance', 'tune', 'piano', 'motor', 'thermostat', 'servo', 'wheel', 'plant', 'strength', 'parking'];
const MAIN = { board: 'uno', blink: 'led', button: 'button', knob: 'pot', rgb: 'rgb', 'night-light': 'ldr', distance: 'hcsr04', tune: 'buzzer', piano: 'button', motor: 'motor', thermostat: 'tmp36', servo: 'servo', wheel: 'stepper', plant: 'soil', strength: 'fsr', parking: 'traffic' };
const COMPONENTS = ['uno', 'led', 'resistor', 'button', 'pot', 'rgb', 'buzzer', 'ldr', 'tmp36', 'fsr', 'diode', 'npn', 'traffic', 'motor', 'servo', 'hcsr04', 'stepper', 'oled', 'soil'];
const ROW = { a: -14, b: -11.46, c: -8.92, d: -6.38, e: -3.84, f: 3.84, g: 6.38, h: 8.92, i: 11.46, j: 14 };
const HIDE = '.viewer-toolbar, .viewer-corner, .status, .embed-bar, .gl-guard, .part-window { visibility: hidden !important; }';
const want = (file) => !only || file.startsWith(only);

async function open3d(page, hash, labels = true) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/?test&embed${hash}`);
  await page.waitForFunction(() => window.__rq?.debug?.lookAt, null, { timeout: 30_000 });
  await page.addStyleTag({ content: HIDE + (labels ? '' : '.overlay { visibility: hidden !important; }') });
  await page.waitForTimeout(600);
}
const snap = async (page, file) => { await page.waitForTimeout(2200); await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 82 }); console.log('✓', file); };

// where a project's main part is on the bench (world mm), and how close to look
async function mainPart(page, project) {
  const type = MAIN[project];
  if (type === 'uno') return [-38, 2, 2.4];
  const parts = await page.evaluate(() => window.__rq.debug.build?.()?.parts ?? null);
  const p = parts?.find((x) => x.type === type);
  if (!p) return null;
  if ('x' in p.at) return [p.at.x, p.at.z, type === 'soil' ? 1.7 : 2.6];
  const bb = parts.find((x) => x.id === (p.at.board ?? 'bb'))?.at ?? { x: 50, z: 8 };
  return [bb.x + (p.at.col + 1 - 15.5) * 2.54, bb.z + ROW[p.at.row], 4];
}

async function card(page, file, title, sub, image) {
  const img = image && fs.existsSync(path.join(OUT, image)) ? fs.readFileSync(path.join(OUT, image)).toString('base64') : null;
  const font = fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')).toString('base64');
  await page.setViewportSize({ width: 1200, height: 630 });
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: N; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 1000; }
    body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: N, sans-serif; background: radial-gradient(circle at 80% 30%, #145560, #0E2A33 60%); color: #fff; position: relative; }
    .pic { position: absolute; inset: 0 0 0 420px; ${img ? `background: url(data:image/jpeg;base64,${img}) center / cover;` : ''} }
    .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #0E2A33 36%, rgba(14,42,51,.85) 46%, rgba(14,42,51,0) 70%); }
    .txt { position: absolute; left: 64px; top: 0; bottom: 0; width: ${img ? 560 : 1000}px; display: flex; flex-direction: column; justify-content: center; }
    .k { color: #5BD6DE; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; font-size: 22px; }
    h1 { font-size: ${title.length > 34 ? 52 : 64}px; line-height: 1.05; margin: 14px 0 18px; font-weight: 900; }
    p { font-size: 26px; line-height: 1.35; margin: 0; color: #CFE6EA; }
    .b { position: absolute; left: 64px; bottom: 44px; font-weight: 900; font-size: 24px; letter-spacing: .06em; }
    .b span { color: #5BD6DE; }
    .play { position: absolute; right: 64px; bottom: 44px; background: #0E7C86; border-radius: 999px; padding: 14px 26px; font-weight: 900; font-size: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  </style></head><body><div class="pic"></div><div class="fade"></div>
    <div class="txt"><div class="k">Free Arduino tutorial</div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
    <div class="b">LEARN <span>ARDUINO</span> · learnarduino.tech</div><div class="play">▶ Try it in 3D</div></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 86 });
  console.log('✓', file);
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const id of PROJECTS) {
  if (want(`${id}-hero.jpg`) || want(`${id}-close.jpg`)) {
    await open3d(page, `#/projects/${id}`);
    await page.evaluate(() => window.__rq.debug.store().fitCamera());        // the whole circuit, clear and complete
    if (want(`${id}-hero.jpg`)) await snap(page, `${id}-hero.jpg`);
    const look = await mainPart(page, id);
    if (look && want(`${id}-close.jpg`)) {
      await page.addStyleTag({ content: '.overlay { visibility: hidden !important; }' });
      await page.evaluate(([x, z, zoom]) => window.__rq.debug.lookAt(x, 0, z, zoom), look);
      await snap(page, `${id}-close.jpg`);
    }
  }
  if (id !== 'board' && want(`${id}-schematic.png`)) {
    await page.setViewportSize({ width: 1500, height: 1400 });
    await page.goto(`${BASE}/?test#/projects/${id}/build`);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    const svg = page.locator('.schem__sheet svg');
    await svg.waitFor();
    await svg.evaluate((e) => { e.setAttribute('width', String(e.viewBox.baseVal.width * 1.5)); e.setAttribute('height', String(e.viewBox.baseVal.height * 1.5)); e.closest('.schem__sheet').style.maxHeight = 'none'; e.closest('.schem__sheet').style.overflow = 'visible'; });
    await page.waitForTimeout(300);
    await svg.screenshot({ path: path.join(OUT, `${id}-schematic.png`) });
    console.log('✓', `${id}-schematic.png`);
  }
}
for (const type of COMPONENTS) {
  if (!want(`${type}-3d.jpg`)) continue;
  await open3d(page, `#/components/${type}`, false);
  await snap(page, `${type}-3d.jpg`);
}
// share cards: every article's own
for (const a of loadArticles()) {
  if (!a.og || !want(a.og)) continue;
  const title = a.title.split(' — ')[0].split(': ')[0].replace(/ \(.*\)$/, '');
  const sub = a.kind === 'project' ? 'Wiring, code line by line — and the project live in 3D' : a.kind === 'component' ? 'How it works, the pins, and how to use it with Arduino' : 'Explained simply, with pictures — try it live in 3D';
  await card(page, a.og, title, sub, a.image);
}
await browser.close();
