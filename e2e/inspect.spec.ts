import { expect, test, type Page } from '@playwright/test';

// Test-mode hooks exposed by <Inspectable>: where a part is on screen, and how far it is lifted (mm).
type Debug = { partScreenPos?(id: string): { x: number; y: number } | null; lift?(id: string): number };
const rq = () => (window as unknown as { __rq?: { debug: Debug } }).__rq?.debug;
const screenPos = (page: Page) => page.evaluate(`(${rq})()?.partScreenPos?.('ZU4') ?? null`) as Promise<{ x: number; y: number } | null>;
const lift = (page: Page, id = 'ZU4') => page.evaluate(`(${rq})()?.lift?.('${id}') ?? 0`) as Promise<number>;
const posOf = (page: Page, id: string) => page.evaluate(`(${rq})()?.partScreenPos?.('${id}') ?? null`) as Promise<{ x: number; y: number } | null>;
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
  await page.mouse.move(20, 300);
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
  await page.mouse.click(20, 300);
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
  await page.mouse.click(Math.min(bb.x, 1000), bb.y);
  await expect(page.getByTestId('info-sheet')).toBeHidden();
});
