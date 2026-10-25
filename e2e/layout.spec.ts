import { expect, test, type Locator } from '@playwright/test';

const box = async (l: Locator) => (await l.boundingBox())!;
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

test('the 3D view lives in its own card and no content covers it', async ({ page }) => {
  await page.goto('/?test');
  const viewer = page.getByTestId('viewer');
  const canvas = viewer.locator('canvas[data-engine]');
  await expect(canvas).toBeVisible();
  const v = await box(viewer), c = await box(canvas);
  expect(c.x).toBeGreaterThanOrEqual(v.x - 1);
  expect(c.y).toBeGreaterThanOrEqual(v.y - 1);
  expect(c.x + c.width).toBeLessThanOrEqual(v.x + v.width + 1);
  expect(c.y + c.height).toBeLessThanOrEqual(v.y + v.height + 1);
  for (const id of ['info-card', 'code-card', 'projects']) {
    const el = page.getByTestId(id);
    await el.scrollIntoViewIfNeeded();
    expect(overlap(await box(viewer), await box(el)), id).toBe(false);
  }
  expect(overlap(await box(viewer), await box(page.getByRole('navigation', { name: 'Main' })))).toBe(false);
});

test('main navigation: Home, Projects, Components, Build, Settings', async ({ page }) => {
  await page.goto('/?test');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Home', 'Projects', 'Components', 'Build', 'Settings']) await expect(nav.getByRole('button', { name })).toBeVisible();
  await nav.getByRole('button', { name: 'Components' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Coming soon' })).toBeVisible();
});

test('the viewer toolbar rotates and zooms the camera', async ({ page }) => {
  await page.goto('/?test');
  const bar = page.getByRole('toolbar', { name: '3D view' });
  for (const name of ['Rotate left', 'Rotate right', 'Zoom out', 'Zoom in', 'Reset view', 'Current', 'Labels']) await expect(bar.getByRole('button', { name })).toBeVisible();
  type Cam = { azimuth: number; zoom: number };
  // null until the 3D scene has registered its test hook
  const cam = () => page.evaluate(() => (window as unknown as { __rq?: { debug: { camera?(): Cam } } }).__rq?.debug.camera?.() ?? null);
  await expect.poll(cam).not.toBeNull();
  const before = (await cam())!;
  await bar.getByRole('button', { name: 'Rotate left' }).click();
  await expect.poll(async () => Math.abs((await cam())!.azimuth - before.azimuth)).toBeGreaterThan(0.3);
  await bar.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => (await cam())!.zoom).toBeGreaterThan(before.zoom * 1.1);
});

test('projects open their scene; the info tabs explain the board', async ({ page }) => {
  await page.goto('/?test');
  const info = page.getByTestId('info-card');
  await expect(info).toContainText('UNO');
  await info.getByRole('tab', { name: 'Specifications' }).click();
  await expect(info).toContainText('16 MHz');
  const projects = page.getByTestId('projects');
  await projects.scrollIntoViewIfNeeded();
  await projects.getByRole('button', { name: /Blink an LED/ }).click();
  await expect(page.locator('[data-hotspot="led"]')).toBeVisible();
});

test('"Try it yourself" shows the blink code and runs it', async ({ page }) => {
  await page.goto('/?test');
  const code = page.getByTestId('code-card');
  await code.scrollIntoViewIfNeeded();
  await expect(code).toContainText('digitalWrite(13, HIGH);');
  await code.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Uploading…');
  await expect(page.getByTestId('status')).toHaveText('Pin 13 HIGH · LED on', { timeout: 10_000 });
});

test('project cards show rendered pictures of the real parts', async ({ page }) => {
  await page.goto('/?test');
  const projects = page.getByTestId('projects');
  const thumb = (name: RegExp) => projects.getByRole('button', { name }).locator('img.project__thumb');
  for (const [name, file] of [[/Meet the board/, 'uno'], [/Blink an LED/, 'led-red']] as const) {
    const img = thumb(name);
    await expect(img).toHaveAttribute('src', new RegExp(file));
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(100);
  }
});

type Snap = { uploading: boolean; rxLed: boolean; txLed: boolean; line: number | null; pinHigh: boolean };
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __rq: { debug: { store(): Snap } } }).__rq.debug.store());

test('Run uploads (RX/TX flicker), then runs with the current line highlighted and output in the serial monitor', async ({ page }) => {
  await page.goto('/?test');
  const code = page.getByTestId('code-card');
  await code.scrollIntoViewIfNeeded();
  await code.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('Uploading…');
  await expect(code.getByRole('progressbar')).toBeVisible();
  const leds = new Set<string>();
  for (let i = 0; i < 12; i++) { const s = await snap(page); leds.add(`${s.rxLed}${s.txLed}`); await page.waitForTimeout(40); }
  expect(leds.size).toBeGreaterThan(1); // RX/TX are flickering
  await expect(page.getByTestId('status')).toHaveText('Pin 13 HIGH · LED on', { timeout: 10_000 });
  const monitor = page.getByRole('log', { name: 'Serial monitor' });
  await expect(monitor).toContainText('LED on');
  const active = code.locator('.code__line.is-running');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(/digitalWrite\(13, HIGH\);|Serial\.println\("LED on"\);|delay\(1000\);/);
  await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off', { timeout: 10_000 });
  await expect(active).toHaveText(/digitalWrite\(13, LOW\);|Serial\.println\("LED off"\);|delay\(1000\);/);
  await expect(monitor).toContainText('LED off');
});

test('the side rail shows icons only; its arrow expands it to show names', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-portrait', 'phones held upright use the bottom bar with names');
  await page.goto('/?test');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const label = nav.getByText('Components', { exact: true });
  await expect(label).toBeHidden();
  await nav.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(label).toBeVisible();
  await expect(nav.getByText('Settings', { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(label).toBeHidden();
});

test('each project explains itself in four formats: overview, pinout table, code steps, spec cards', async ({ page }) => {
  await page.goto('/?test');
  const info = page.getByTestId('info-card');
  const tab = (name: string) => info.getByRole('tab', { name }).click();
  const projects = page.getByTestId('projects');
  await projects.scrollIntoViewIfNeeded();
  await projects.getByRole('button', { name: /Blink an LED/ }).click();
  await info.scrollIntoViewIfNeeded();

  await expect(info.getByRole('heading', { name: 'Blink an LED' })).toBeVisible();
  await expect(info.locator('.overview__point')).toHaveCount(3);

  await tab('Pinout');
  const table = info.getByRole('table');
  for (const h of ['Pin', 'Connects to', 'What it does']) await expect(table.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(table.getByRole('row', { name: /D13/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /GND/ })).toBeVisible();

  await tab('Example');
  await expect(info.getByRole('heading', { name: 'How the code works' })).toBeVisible();
  await expect(info.getByRole('listitem')).toHaveCount(4);
  await expect(info.locator('code').first()).toBeVisible();

  await tab('Specifications');
  await expect(info.locator('.spec-card')).toHaveCount(5);
  await expect(info.locator('.spec-card', { hasText: 'LED current' })).toContainText('14 mA');

  await projects.getByRole('button', { name: /Meet the board/ }).click();
  await tab('Pinout');
  await expect(info.getByRole('row', { name: /A0–A5/ })).toBeVisible();
});

test('desktop and landscape: everything fits one fixed window; only panels scroll inside', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-portrait', 'phones held upright scroll the page, like the reference');
  await page.goto('/?test');
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
  const page_ = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, vh: innerHeight, vw: innerWidth }));
  expect(page_.h).toBeLessThanOrEqual(page_.vh);
  expect(page_.w).toBeLessThanOrEqual(page_.vw);
  // short landscape phones scroll the right column by itself (like the reference); desktop shows every panel at once
  const inView = info.project.name === 'desktop' ? ['viewer', 'info-card', 'code-card', 'projects'] : ['viewer', 'projects'];
  for (const id of inView) {
    const b = await box(page.getByTestId(id));
    expect(b.y, id).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, id).toBeLessThanOrEqual(page_.vh + 1);
  }
});

test('panels grow and shrink with their buttons: info, code, serial monitor', async ({ page }) => {
  await page.goto('/?test');
  const info = page.getByTestId('info-card'), code = page.getByTestId('code-card');
  const serial = page.getByRole('log', { name: 'Serial monitor' });
  await code.scrollIntoViewIfNeeded();
  const h0 = (await box(serial)).height;

  await page.getByRole('button', { name: 'Expand code' }).click();
  await expect(page.getByRole('button', { name: 'Shrink code' })).toBeVisible();
  await page.getByRole('button', { name: 'Shrink code' }).click();
  await expect(info).toBeVisible();

  await page.getByRole('button', { name: 'Expand serial monitor' }).click();
  await expect.poll(async () => (await box(serial)).height).toBeGreaterThan(h0 + 40);
  await page.getByRole('button', { name: 'Shrink serial monitor' }).click();
  await expect.poll(async () => Math.round((await box(serial)).height)).toBe(Math.round(h0));

  await info.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await page.getByRole('button', { name: 'Shrink panel' }).click();
  await expect(code).toBeVisible();
});

test('desktop: an expanded panel takes the whole column, like the reference', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/?test');
  const infoCard = page.getByTestId('info-card'), code = page.getByTestId('code-card');
  const c0 = (await box(code)).height;
  await page.getByRole('button', { name: 'Expand code' }).click();
  await expect(infoCard).toBeHidden();
  expect((await box(code)).height).toBeGreaterThan(c0 * 1.5);
  await page.getByRole('button', { name: 'Shrink code' }).click();
  await page.getByRole('button', { name: 'Expand panel' }).click();
  await expect(code).toBeHidden();
});

test('phone held upright: scrolled to the bottom, the last controls sit clear of the bottom bar', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-portrait');
  await page.goto('/?test');
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
  await page.evaluate(() => { document.querySelector('main.app')!.scrollTop = 1e6; });
  const nav = await box(page.getByRole('navigation', { name: 'Main' }));
  for (const name of ['Send to board', 'Clear']) {
    const b = await box(page.getByRole('button', { name }));
    expect(b.y + b.height, name).toBeLessThanOrEqual(nav.y);
  }
});
