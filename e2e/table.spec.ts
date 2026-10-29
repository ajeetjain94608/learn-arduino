import { expect, test, type Page } from '@playwright/test';

type Dbg = { build(): Record<string, (...a: unknown[]) => unknown> & { parts: { id: string; type: string; at: Record<string, number | string> }[]; wires: { from: string; to: string }[] } };
const store = (page: Page) => page.evaluate(() => { const b = (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build(); return { parts: b.parts, wires: b.wires }; });
const call = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build()[f as string](...(a as unknown[])), [fn, args] as const);
const screenOf = (page: Page, ref: string) => page.evaluate((r) => (window as unknown as { __rq: { debug: { buildPinScreen(r: string): { x: number; y: number } } } }).__rq.debug.buildPinScreen(r), ref);

async function openBuild(page: Page) {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.removeItem('rq-build-v1'));
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' }).click();
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
}

test.describe('Building: the breadboard is a part like any other', () => {
  test('a new build has no breadboard, and new parts stand on the table with wires straight to their legs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openBuild(page);
    expect((await store(page)).parts).toEqual([]);
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

  test('add as many breadboards as you like, each its own part', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('button', { name: 'Add Breadboard' }).click();
    await page.getByRole('button', { name: 'Add Breadboard' }).click();
    expect((await store(page)).parts.map((p) => p.id)).toEqual(['bb', 'breadboard2']);
    expect(await call(page, 'addWire', 'breadboard2.5a', 'uno.D13')).toBeTruthy();
  });

  test('pressing a part and dragging it onto a breadboard puts its legs in the holes; dragging it off takes it out', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the parts are too small to grab on a phone-sized 3D view without zooming');
    await openBuild(page);
    await call(page, 'addPart', 'breadboard');
    const led = (await call(page, 'addPart', 'led')) as string;
    await call(page, 'select', led);
    await page.getByRole('button', { name: 'Fit everything in view' }).click();
    await page.waitForTimeout(1500);
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const from = await page.evaluate((i) => (window as unknown as { __rq: { debug: { buildPartScreen(i: string): { x: number; y: number } } } }).__rq.debug.buildPartScreen(i), led);
    const hole = await screenOf(page, 'bb.12c');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(hole.x, hole.y, { steps: 12 });
    await page.mouse.up();
    const at = (await store(page)).parts.find((p) => p.id === led)!.at;
    expect(at.board).toBe('bb');
    expect(typeof at.col).toBe('number');
  });

  test('a breadboard that has parts in it can be taken away: they lie down on the table', async ({ page }) => {
    await openBuild(page);
    await call(page, 'addPart', 'breadboard');
    const led = (await call(page, 'addPart', 'led')) as string;
    await call(page, 'movePart', led, { col: 8, row: 'c' });
    await call(page, 'removePart', 'bb');
    const { parts } = await store(page);
    expect(parts.map((p) => p.id)).toEqual([led]);
    expect('x' in parts[0].at).toBe(true);
  });
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

test('dragging a wire in 3D from each power-header GND socket, and to a leg of a part on the table', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the pins are too close together to hit on a phone-sized 3D view without zooming');
  await openBuild(page);
  await call(page, 'addPart', 'breadboard');
  await page.getByRole('button', { name: 'Add LED' }).click();
  await call(page, 'select', null);
  await page.getByRole('button', { name: 'Fit everything in view' }).click();
  await page.waitForTimeout(1500);
  await page.getByTestId('viewer').scrollIntoViewIfNeeded();
  for (const [from, to] of [['uno.GND_P1', 'bb.6c'], ['uno.GND_P2', 'bb.9c'], ['uno.D13', 'led1.A']]) {
    const a = await screenOf(page, from), b = await screenOf(page, to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  }
  const wires = (await store(page)).wires.map((w) => [w.from, w.to].sort().join('>'));
  expect(wires).toEqual(expect.arrayContaining(['bb.6c>uno.GND_P1', 'bb.9c>uno.GND_P2', 'led1.A>uno.D13']));
  expect((await store(page)).parts.find((p) => p.id === 'bb')!.at).toEqual(expect.objectContaining({ x: 50, z: 8 })); // pulling wires did not move the board
});

test('pulling a wire out of a breadboard hole (or a module pin) does not carry the board or the module', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the pins are too close together to hit on a phone-sized 3D view without zooming');
  await openBuild(page);
  await call(page, 'addPart', 'breadboard');
  await call(page, 'addPart', 'hcsr04');
  await call(page, 'select', null);
  await page.getByRole('button', { name: 'Fit everything in view' }).click();
  await page.waitForTimeout(1500);
  await page.getByTestId('viewer').scrollIntoViewIfNeeded();
  const before = (await store(page)).parts.map((p) => JSON.stringify(p.at));
  for (const [from, to] of [['bb.6c', 'uno.D8'], ['hcsr041.TRIG', 'uno.D9']]) {
    const a = await screenOf(page, from), b = await screenOf(page, to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  }
  const s = await store(page);
  expect(s.wires.map((w) => [w.from, w.to].sort().join('>'))).toEqual(expect.arrayContaining(['bb.6c>uno.D8', 'hcsr041.TRIG>uno.D9']));
  expect(s.parts.map((p) => JSON.stringify(p.at))).toEqual(before);
});

test.describe('Wiring as a schematic', () => {
  const pick = (page: Page, ref: string) => page.locator(`[data-ref="${ref}"]`).click({ force: true });
  test('the wiring tab opens on a schematic; two pins picked in turn are joined with a jumper', async ({ page }) => {
    await openBuild(page);
    await call(page, 'addPart', 'breadboard');
    const led = (await call(page, 'addPart', 'led')) as string;
    await call(page, 'movePart', led, { col: 10, row: 'c' });
    await call(page, 'select', null);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await expect(page.getByTestId('schematic')).toBeVisible();
    await expect(page.locator('.schem__sheet')).toContainText('LED 1');                // its symbol is on the drawing
    await pick(page, 'uno.D13');
    await expect(page.getByTestId('schematic')).toContainText('UNO D13 is picked');
    await pick(page, 'led1.A');
    const w = (await store(page)).wires;
    expect(w).toHaveLength(1);
    expect([w[0].from, w[0].to].sort()).toEqual(['bb.10a', 'uno.D13']);             // a jumper in a free hole of the LED's strip
    // the drawing now has a wire for it, and the pin says which net it is on
    await expect(page.locator('.schem__wire')).toHaveCount(1);
    await expect(page.locator('[data-ref="led1.A"]')).toHaveAttribute('aria-label', /D13/);
    await pick(page, 'led1.K');
    await pick(page, 'uno.GND');
    expect((await store(page)).wires).toHaveLength(2);
  });
  test('the List view still has the pickers', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.getByRole('combobox', { name: 'From' })).toBeVisible();
  });
});
