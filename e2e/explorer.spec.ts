import { expect, test, type Page } from '@playwright/test';

const status = (page: Page) => page.getByTestId('status');
const card = (page: Page, id: string) => page.locator(`[data-hotspot="${id}"]`);
const electronsVisible = (page: Page) => page.evaluate(() => Boolean(window.__rq?.debug.electronsVisible));
const canvas = (page: Page) => page.locator('canvas[data-engine]');
// Themes and About live in Settings (main navigation); the project cards switch Board / Circuit.
const settings = async (page: Page, name: string) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name }).click();
};
const project = (page: Page, name: RegExp) => page.getByTestId('projects').getByRole('button', { name }).click();

test('Run starts the blink program', async ({ page }) => {
  await page.goto('/?test');
  await expect(status(page)).toHaveText('Program stopped');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(status(page)).toHaveText('Uploading…'); // Run uploads the sketch first, like a real board
  await expect(status(page)).toHaveText('Pin 13 HIGH · LED on', { timeout: 4000 });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(status(page)).toHaveText('Program stopped');
});

test('the chosen theme survives a reload', async ({ page }) => {
  await page.goto('/?test');
  await settings(page, 'Night Workshop theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

test('circuit view shows circuit labels and hides board-only ones', async ({ page }) => {
  await page.goto('/?test');
  await expect(card(page, 'usb')).toBeVisible();
  await project(page, /Blink an LED/);
  await expect(card(page, 'usb')).toBeHidden();
  await expect(card(page, 'led')).toBeVisible();
});

test('tapping a label explains the part; tapping the bench closes it', async ({ page }) => {
  await page.goto('/?test');
  await card(page, 'usb').click();
  await expect(page.getByTestId('info-sheet')).toContainText('upload your programs');
  await canvas(page).click({ position: { x: 20, y: 300 } });
  await expect(page.getByTestId('info-sheet')).toBeHidden();
});

test('About lists the licence credits', async ({ page }) => {
  await page.goto('/?test');
  await settings(page, 'About');
  await expect(page.getByRole('dialog', { name: 'About RoboQuest' }).getByText('Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0)')).toBeVisible();
});

test('current shows only in the circuit view while pin 13 is HIGH, even with rapid toggling', async ({ page }) => {
  await page.goto('/?test&hold');
  await page.getByRole('button', { name: 'Current' }).click();
  await project(page, /Meet the board/);
  await page.waitForTimeout(400);
  expect(await electronsVisible(page)).toBe(false);
  await project(page, /Blink an LED/);
  await expect.poll(() => electronsVisible(page)).toBe(true);
  await expect(status(page)).toHaveText('Current: pin 13 → LED → resistor → GND');
  await page.getByRole('button', { name: 'Current' }).click();
  await expect.poll(() => electronsVisible(page)).toBe(false);
});

const loseContext = (page: Page, restoreAfterMs: number | null) =>
  page.evaluate((ms) => {
    const c = document.querySelector('canvas[data-engine]') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    if (ms !== null) setTimeout(() => ext.restoreContext(), ms);
  }, restoreAfterMs);

test('a lost 3D context that comes back leaves no error card', async ({ page }) => {
  await page.goto('/?test');
  await expect(canvas(page)).toBeVisible();
  await loseContext(page, 600);
  await expect(page.getByTestId('gl-guard')).toBeVisible(); // "Restoring 3D…" while the context is gone
  await expect(page.getByTestId('gl-guard')).toBeHidden({ timeout: 3000 });
  await expect(page.getByRole('button', { name: 'Tap to reload 3D' })).toHaveCount(0);
  await expect(canvas(page)).toBeVisible();
});

test('a lost 3D context that never returns offers a reload that works', async ({ page }) => {
  await page.goto('/?test');
  await expect(canvas(page)).toBeVisible();
  await loseContext(page, null);
  const reload = page.getByRole('button', { name: 'Tap to reload 3D' });
  await expect(reload).toBeVisible({ timeout: 5000 }); // guard gives up after 3 s; allow for render + polling
  await reload.click();
  await expect(page.getByTestId('gl-guard')).toBeHidden();
  await expect(canvas(page)).toBeVisible();
  const ok = await page.evaluate(() => !(document.querySelector('canvas[data-engine]') as HTMLCanvasElement).getContext('webgl2')!.isContextLost());
  expect(ok).toBe(true);
});

test('Settings opens from the navigation and closes with its close button or a tap outside', async ({ page }) => {
  await page.goto('/?test');
  const open = () => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await open();
  await expect(dialog.getByRole('button', { name: 'Mint theme' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await open();
  await page.mouse.click(30, 200); // the dimmed area outside the panel
  await expect(dialog).toBeHidden();
});
