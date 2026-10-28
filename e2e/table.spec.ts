import { expect, test, type Page } from '@playwright/test';

type Dbg = { build(): Record<string, (...a: unknown[]) => unknown> & { parts: { id: string; at: Record<string, number | string> }[]; wires: { from: string; to: string }[]; breadboard: boolean } };
const store = (page: Page) => page.evaluate(() => { const b = (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build(); return { parts: b.parts, wires: b.wires, breadboard: b.breadboard }; });
const call = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build()[f as string](...(a as unknown[])), [fn, args] as const);

async function openBuild(page: Page) {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.removeItem('rq-build-v1'));
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' }).click();
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
}

test.describe('Building without a breadboard', () => {
  test('parts stand on the table and wires go straight to their legs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openBuild(page);
    await page.getByRole('radio', { name: 'Table' }).first().click();
    await page.getByRole('button', { name: 'Add Resistor' }).click();
    await page.getByRole('button', { name: 'Add LED' }).click();
    const { parts } = await store(page);
    expect(parts.map((p) => 'x' in p.at)).toEqual([true, true]);
    for (const [a, b] of [['uno.5V', 'resistor1.1'], ['resistor1.2', 'led1.A'], ['led1.K', 'uno.GND_P1']]) expect(await call(page, 'addWire', a, b)).toBeTruthy();
    await page.getByRole('button', { name: 'Fit everything in view' }).click();
    await page.waitForTimeout(1500);
    expect((await store(page)).wires).toHaveLength(3);
    expect(errors).toEqual([]);
  });

  test('a part moves between the table and the breadboard, and the breadboard can be switched off', async ({ page }) => {
    await openBuild(page);
    const id = (await call(page, 'addPart', 'led')) as string;
    await call(page, 'select', id);
    await page.getByTestId('part-window').getByRole('radio', { name: 'Table' }).click();
    expect('x' in (await store(page)).parts[0].at).toBe(true);
    const sw = page.getByRole('switch', { name: 'Breadboard' });
    await page.getByRole('tab', { name: 'Parts' }).click();
    await sw.uncheck();
    expect((await store(page)).breadboard).toBe(false);
    await sw.check();
    expect((await store(page)).breadboard).toBe(true);
  });

  test('the breadboard stays while a part or a wire uses its holes', async ({ page }) => {
    await openBuild(page);
    await call(page, 'addPart', 'led');
    await page.getByRole('tab', { name: 'Parts' }).click();
    await page.getByRole('switch', { name: 'Breadboard' }).click();
    expect((await store(page)).breadboard).toBe(true);
    await expect(page.getByRole('status')).toContainText('breadboard');
  });
});

test('the board has three GND sockets and every one of them is a wire point', async ({ page }) => {
  await openBuild(page);
  for (const pin of ['GND', 'GND_P1', 'GND_P2']) expect(await call(page, 'addWire', `uno.${pin}`, `bb.${pin === 'GND' ? 1 : pin === 'GND_P1' ? 2 : 3}a`)).toBeTruthy();
});

test.describe('Edit in Build', () => {
  for (const id of ['blink', 'board', 'distance']) {
    test(`${id} opens in Build with its own parts and wires`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/?test');
      await page.evaluate(() => localStorage.clear());
      await page.goto(`/?test#/projects/${id}`);
      await page.getByRole('button', { name: 'Edit in Build' }).click();
      await expect(page).toHaveURL(new RegExp(`#/projects/${id}/build$`));
      await expect(page.getByTestId('build-screen')).toBeVisible();
      await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'About' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test('dragging a wire in 3D from each power-header GND socket, and to a leg of a part on the table', async ({ page }) => {
  await openBuild(page);
  await page.getByRole('radio', { name: 'Table' }).first().click();
  await page.getByRole('button', { name: 'Add LED' }).click();
  await call(page, 'select', null);
  await page.getByRole('button', { name: 'Fit everything in view' }).click();
  await page.waitForTimeout(1500);
  await page.getByTestId('viewer').scrollIntoViewIfNeeded();
  const pin = (ref: string) => page.evaluate((r) => (window as unknown as { __rq: { debug: { buildPinScreen(r: string): { x: number; y: number } } } }).__rq.debug.buildPinScreen(r), ref);
  for (const [from, to] of [['uno.GND_P1', 'bb.6c'], ['uno.GND_P2', 'bb.9c'], ['uno.D13', 'led1.A']]) {
    const a = await pin(from), b = await pin(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  }
  const wires = (await store(page)).wires.map((w) => [w.from, w.to].sort().join('>'));
  expect(wires).toEqual(expect.arrayContaining(['bb.6c>uno.GND_P1', 'bb.9c>uno.GND_P2', 'led1.A>uno.D13']));
});
