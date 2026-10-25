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
  const cam = () => page.evaluate(() => (window as unknown as { __rq: { debug: { camera(): { azimuth: number; zoom: number } } } }).__rq.debug.camera());
  await expect.poll(cam).toBeTruthy();
  const before = await cam();
  await bar.getByRole('button', { name: 'Rotate left' }).click();
  await expect.poll(async () => Math.abs((await cam()).azimuth - before.azimuth)).toBeGreaterThan(0.3);
  await bar.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => (await cam()).zoom).toBeGreaterThan(before.zoom * 1.1);
});

test('projects open their scene; the info tabs explain the board', async ({ page }) => {
  await page.goto('/?test');
  const info = page.getByTestId('info-card');
  await expect(info).toContainText('UNO');
  await info.getByRole('tab', { name: 'Specs' }).click();
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
  await expect(page.getByTestId('status')).toHaveText('Pin 13 HIGH · LED on', { timeout: 1500 });
});
