import { expect, test, type Page } from '@playwright/test';

type Dbg = { build(): Record<string, (...a: unknown[]) => unknown> & { parts: { id: string; at: Record<string, number | string>; rot?: number }[] }; buildPartScreen?(id: string): { x: number; y: number } | null };
const dbg = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build()[f as string](...(a as unknown[])), [fn, args] as const);
const part = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build().parts.find((p) => p.id === i)!, id);
const screenOf = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.buildPartScreen!(i), id);

async function openBuild(page: Page) {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.removeItem('rq-build-v1'));
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' }).click();
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
}

test.describe('Press and drag a part, and turn it', () => {
  test('a module on the bench follows the mouse', async ({ page }) => {
    await openBuild(page);
    const id = (await dbg(page, 'addPart', 'servo')) as string;
    await dbg(page, 'select', id);
    await page.getByRole('button', { name: 'Fit everything in view' }).click();
    await page.waitForTimeout(1500); // the camera eases out
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const before = await part(page, id), c = (await screenOf(page, id))!;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 40, c.y + 30, { steps: 8 });
    await page.mouse.up();
    const after = await part(page, id);
    expect(after.at).not.toEqual(before.at);
  });

  test('a part in the breadboard moves hole by hole when dragged', async ({ page }) => {
    await openBuild(page);
    const id = (await dbg(page, 'addPart', 'led')) as string;
    await dbg(page, 'select', id);
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const before = await part(page, id), c = (await screenOf(page, id))!;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 70, c.y, { steps: 8 });
    await page.mouse.up();
    expect((await part(page, id)).at.col).toBeGreaterThan(before.at.col as number);
  });

  test('the Turn buttons turn a module by 15° and a breadboard part by a quarter turn', async ({ page }) => {
    await openBuild(page);
    const m = (await dbg(page, 'addPart', 'servo')) as string;
    await dbg(page, 'select', m);
    await page.getByRole('button', { name: 'Turn right' }).click();
    expect((await part(page, m)).rot).toBe(15);
    const slider = page.getByRole('slider', { name: 'Angle in degrees' });
    await slider.fill('90');
    expect((await part(page, m)).rot).toBe(90);
    const led = (await dbg(page, 'addPart', 'led')) as string;
    await dbg(page, 'movePart', led, { col: 8, row: 'c' });
    await dbg(page, 'select', led);
    await expect(page.getByRole('slider', { name: 'Angle in degrees' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Turn right' }).click();
    expect((await part(page, led)).rot).toBe(90);
  });

  test('the push button has no Turn control', async ({ page }) => {
    await openBuild(page);
    await dbg(page, 'select', (await dbg(page, 'addPart', 'button')) as string);
    await expect(page.getByRole('button', { name: 'Turn right' })).toHaveCount(0);
  });

  test('the Turn buttons are big enough to tap', async ({ page }) => {
    await openBuild(page);
    await dbg(page, 'select', (await dbg(page, 'addPart', 'servo')) as string);
    for (const n of ['Turn left', 'Turn right']) {
      const b = (await page.getByRole('button', { name: n }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(47.5);
      expect(b.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
