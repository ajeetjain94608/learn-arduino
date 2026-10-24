import { expect, test, type Page } from '@playwright/test';

const status = (page: Page) => page.getByTestId('status');
const card = (page: Page, id: string) => page.locator(`[data-hotspot="${id}"]`);
const electronsVisible = (page: Page) => page.evaluate(() => Boolean(window.__rq?.debug.electronsVisible));
const canvas = (page: Page) => page.locator('canvas[data-engine]');
// Themes, Board/Circuit and About live in the side menu (keeps the top of the screen clear for the 3D view).
const menu = async (page: Page, name: string, exact = false) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name, exact }).click();
};

test('Run starts the blink program', async ({ page }) => {
  await page.goto('/?test');
  await expect(status(page)).toHaveText('Program stopped');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(status(page)).toHaveText('Pin 13 HIGH · LED on', { timeout: 1200 });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(status(page)).toHaveText('Program stopped');
});

test('the chosen theme survives a reload', async ({ page }) => {
  await page.goto('/?test');
  await menu(page, 'Night Workshop theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

test('circuit view shows circuit labels and hides board-only ones', async ({ page }) => {
  await page.goto('/?test');
  await expect(card(page, 'usb')).toBeVisible();
  await menu(page, 'Circuit');
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
  await menu(page, 'About');
  await expect(page.getByText('Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0)')).toBeVisible();
});

test('current shows only in the circuit view while pin 13 is HIGH, even with rapid toggling', async ({ page }) => {
  await page.goto('/?test&hold');
  await page.getByRole('button', { name: 'Current' }).click();
  await menu(page, 'Board', true);
  await page.waitForTimeout(400);
  expect(await electronsVisible(page)).toBe(false);
  await menu(page, 'Circuit');
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

test('the top bar stays clear: options live in a side menu that closes after choosing a view', async ({ page }) => {
  await page.goto('/?test');
  const top = page.locator('.topbar');
  await expect(top.getByRole('button', { name: 'Lab theme' })).toHaveCount(0);
  await expect(top.getByRole('button', { name: 'Circuit' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await expect(drawer.getByRole('button', { name: 'Mint theme' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'About' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Circuit' }).click();
  await expect(drawer).toBeHidden();
  await expect(card(page, 'led')).toBeVisible();
});

test('the side menu closes with its close button or by tapping outside it', async ({ page }) => {
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.mouse.click(30, 200); // the dimmed area outside the panel
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
});
