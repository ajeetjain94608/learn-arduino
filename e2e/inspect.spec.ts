import { expect, test, type Page } from '@playwright/test';

// Test-mode hooks exposed by <Inspectable>: where a part is on screen, and how far it is lifted (mm).
type Debug = { partScreenPos?(id: string): { x: number; y: number } | null; lift?(id: string): number };
const rq = () => (window as unknown as { __rq?: { debug: Debug } }).__rq?.debug;
const screenPos = (page: Page) => page.evaluate(`(${rq})()?.partScreenPos?.('ZU4') ?? null`) as Promise<{ x: number; y: number } | null>;
const lift = (page: Page, id = 'ZU4') => page.evaluate(`(${rq})()?.lift?.('${id}') ?? 0`) as Promise<number>;
const posOf = (page: Page, id: string) => page.evaluate(`(${rq})()?.partScreenPos?.('${id}') ?? null`) as Promise<{ x: number; y: number } | null>;
// A spot on empty bench inside the 3D card (the screen edge may be the navigation rail).
const bench = async (page: Page) => { const b = (await page.getByTestId('viewer').boundingBox())!; return { x: b.x + 14, y: b.y + b.height * 0.55 }; };
const chip = async (page: Page) => {
  await expect.poll(() => screenPos(page)).not.toBeNull();
  return (await screenPos(page))!;
};

test('hovering a part lifts it and shows its name; moving away puts it back', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'hover needs a mouse');
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Labels' }).click(); // labels off so cards don't cover the chip
  const p = await chip(page);
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('part-tooltip')).toContainText('ATmega328P');
  await expect.poll(() => lift(page)).toBeGreaterThan(2);
  { const e = await bench(page); await page.mouse.move(e.x, e.y); }
  await expect(page.getByTestId('part-tooltip')).toBeHidden();
  await expect.poll(() => lift(page)).toBeLessThan(0.1);
});

test('tapping a part lifts it and explains it; tapping the bench puts it back', async ({ page }) => {
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Labels' }).click();
  const p = await chip(page);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('info-sheet')).toContainText('brain of the board');
  await expect(page.getByTestId('part-tooltip')).toContainText('ATmega328P');
  await expect.poll(() => lift(page)).toBeGreaterThan(2);
  { const e = await bench(page); await page.mouse.click(e.x, e.y); }
  await expect(page.getByTestId('info-sheet')).toBeHidden();
  await expect.poll(() => lift(page)).toBeLessThan(0.1);
});

test('a selected circuit part stays lifted while the program blinks', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  await page.goto('/?test&view=circuit&run');
  await page.getByRole('button', { name: 'Labels' }).click();
  await expect.poll(() => posOf(page, 'led')).not.toBeNull();
  const p = (await posOf(page, 'led'))!;
  await page.mouse.click(p.x, p.y - 20); // the pivot is at the LED's base; aim at its body
  await expect(page.getByTestId('info-sheet')).toContainText('LED');
  await expect.poll(() => lift(page, 'led')).toBeGreaterThan(2.3);
  let lowest = Infinity;
  for (let i = 0; i < 25; i++) { lowest = Math.min(lowest, await lift(page, 'led')); await page.waitForTimeout(100); }
  expect(lowest).toBeGreaterThan(2);
});

test('tapping empty bench in board view clears a selection, even where hidden circuit parts sit', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Labels' }).click();
  const p = await chip(page);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('info-sheet')).toBeVisible();
  // the (hidden) breadboard lies under the right half of the board view
  const bb = (await posOf(page, 'breadboard'))!;
  const v = (await page.getByTestId('viewer').boundingBox())!;
  await page.mouse.click(Math.min(bb.x, v.x + v.width - 20), Math.min(bb.y, v.y + v.height - 80));
  await expect(page.getByTestId('info-sheet')).toBeHidden();
});

test('pressing the 3D reset button reboots the board and restarts the program', async ({ page }) => {
  await page.goto('/?test&run');
  await page.getByRole('button', { name: 'Labels' }).click();
  await expect.poll(() => posOf(page, 'RESET')).not.toBeNull();
  // wait until the program is in its LOW second, so a restart (which begins HIGH) is visible
  await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off', { timeout: 4000 });
  // From the default angle the USB connector hides the reset button (as on the real board): rotate a little first.
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width * 0.5, vp.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.5 + 220, vp.height * 0.55, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off', { timeout: 4000 });
  const r = (await posOf(page, 'RESET'))!;
  await page.mouse.click(r.x, r.y - 3);
  await expect(page.getByTestId('status')).toHaveText('Resetting…');
  await expect(page.getByTestId('part-tooltip')).toContainText('Reset button');
  await expect(page.getByTestId('status')).toHaveText('Pin 13 HIGH · LED on', { timeout: 1500 });
});

test('a tapped part’s card sits fully inside the 3D view, centred above the toolbar', async ({ page }) => {
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Labels' }).click();
  const p = await chip(page);
  await page.mouse.click(p.x, p.y);
  const tip = page.getByTestId('part-tooltip');
  await expect(tip).toContainText('ATmega328P');
  await page.waitForTimeout(200);
  const v = (await page.getByTestId('viewer').boundingBox())!;
  const t = (await tip.boundingBox())!;
  const bar = (await page.getByRole('toolbar', { name: '3D view' }).boundingBox())!;
  expect(t.x).toBeGreaterThanOrEqual(v.x);
  expect(t.x + t.width).toBeLessThanOrEqual(v.x + v.width);
  expect(t.y).toBeGreaterThanOrEqual(v.y);
  expect(t.y + t.height).toBeLessThanOrEqual(bar.y);
  expect(Math.abs((t.x + t.width / 2) - (v.x + v.width / 2))).toBeLessThan(3);
});
