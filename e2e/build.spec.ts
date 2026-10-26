import { expect, test, type Page } from '@playwright/test';

type BuildDebug = { build(): { parts: { id: string; type: string; at: { col: number; row: string } }[]; wires: unknown[] } };
const build = (page: Page) => page.evaluate(() => (window as unknown as { __rq: { debug: BuildDebug } }).__rq.debug.build());

async function openBuild(page: Page) {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.removeItem('rq-build-v1'));
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' }).click();
  await expect(page.getByTestId('build-screen')).toBeVisible();
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
}

test.describe('Build', () => {
  test('Build opens from the navigation and shows the bench, UNO and breadboard', async ({ page }) => {
    await openBuild(page);
    for (const tab of ['Parts', 'Wiring', 'Code']) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    const bench = page.getByRole('list', { name: 'On the bench' });
    await expect(bench).toContainText('UNO');
    await expect(bench).toContainText('Breadboard');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Build' })).toHaveAttribute('aria-current', 'page');
  });

  test('adding an LED puts it on the breadboard and lists it', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('button', { name: 'Add LED' }).click();
    await expect(page.getByRole('list', { name: 'On the bench' })).toContainText('LED 1');
    expect((await build(page)).parts).toEqual([expect.objectContaining({ id: 'led1', type: 'led', at: { col: 1, row: 'a' } })]);
  });
});

type Dbg = { build(): Record<string, (...a: unknown[]) => unknown> & { parts: { id: string }[] }; buildPartScreen?(id: string): { x: number; y: number } | null };
const dbg = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.build()[f as string](...(a as unknown[])), [fn, args] as const);
const partScreen = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __rq: { debug: Dbg } }).__rq.debug.buildPartScreen!(i), id);

async function runSketch(page: Page, code: string) {
  await page.getByRole('tab', { name: 'Code' }).click();
  await page.getByRole('textbox', { name: 'Sketch code' }).fill(code);
  await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
  await expect(page.getByTestId('status')).not.toHaveText(/Compiling|Uploading/, { timeout: 40_000 });
}
const lastReading = async (page: Page) => Number((await page.getByRole('log', { name: 'Serial monitor' }).innerText()).trim().split('\n').at(-1));

test.describe('Build: inputs three ways', () => {
  test.describe.configure({ timeout: 120_000 });

  test('the pot can be set three ways and the sketch reads it', async ({ page }) => {
    await openBuild(page);
    await dbg(page, 'addPart', 'pot'); // pot1 at 1a: legs 1a, 3a, 5a
    await dbg(page, 'addWire', 'uno.5V', 'bb.1e');
    await dbg(page, 'addWire', 'bb.3e', 'uno.A0');
    await dbg(page, 'addWire', 'bb.5e', 'uno.GND');
    await runSketch(page, 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0));\n  delay(50);\n}\n');
    await dbg(page, 'select', 'pot1');
    const slider = page.getByRole('slider', { name: 'Knob' });
    const box = page.getByRole('spinbutton', { name: 'Knob value' });
    await slider.fill('0');
    await expect.poll(() => lastReading(page), { timeout: 10_000 }).toBeLessThanOrEqual(2);
    await box.fill('1023');
    await box.press('Enter');
    await expect.poll(() => lastReading(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(1021);
    await box.fill('0');
    await box.press('Enter');
    await expect.poll(() => lastReading(page), { timeout: 10_000 }).toBeLessThanOrEqual(2);
    // turn the knob in 3D: grab it and go clockwise round it until it stops (more than its 270° range)
    await page.getByTestId('viewer').scrollIntoViewIfNeeded(); // a person scrolls back up to the bench first
    const c = (await partScreen(page, 'pot1'))!;
    const r = 40;
    await page.mouse.move(c.x, c.y); // grab the knob…
    await page.mouse.down();
    await page.mouse.move(c.x, c.y - r, { steps: 4 }); // …and turn it around its centre
    for (let a = 0; a <= 300; a += 10) { const rad = (a * Math.PI) / 180; await page.mouse.move(c.x + r * Math.sin(rad), c.y - r * Math.cos(rad)); }
    await page.mouse.up();
    await expect.poll(() => lastReading(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(1000);
    expect(Number(await slider.inputValue())).toBeGreaterThan(0.95); // the slider follows the knob
  });

  test('holding the 3D button lights the LED (pull-down circuit)', async ({ page }) => {
    await openBuild(page);
    await dbg(page, 'addPart', 'button'); // button1 at 1e: columns 1 and 3
    const r = (await dbg(page, 'addPart', 'resistor')) as string;
    await dbg(page, 'setParam', r, 'ohms', 10000);
    await dbg(page, 'movePart', r, { col: 3, row: 'b' }); // 3b–7b
    await dbg(page, 'addWire', 'uno.5V', 'bb.1a');
    await dbg(page, 'addWire', 'bb.3a', 'uno.D2');
    await dbg(page, 'addWire', 'bb.7a', 'uno.GND');
    await runSketch(page, 'void setup() {\n  pinMode(2, INPUT);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, digitalRead(2));\n}\n');
    await expect.poll(() => pin13(page), { timeout: 10_000 }).toBe(false);
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const c = (await partScreen(page, 'button1'))!;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect.poll(() => pin13(page), { timeout: 10_000 }).toBe(true);
    await page.mouse.up();
    await expect.poll(() => pin13(page), { timeout: 10_000 }).toBe(false);
  });
});

const BLINK_CODE = 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n';
type Snap = { pinHigh: boolean; circuitState: { parts: Record<string, { brightness?: number }> } | null };
// the level on pin 13 (the Build page does not spell it out: only the Blink circuit does)
const pin13 = (page: Page) => page.evaluate(() => (window as unknown as { __rq: { debug: { store(): { pinHigh: boolean } } } }).__rq.debug.store().pinHigh);
const store = (page: Page) => page.evaluate(() => (window as unknown as { __rq: { debug: { store(): Snap } } }).__rq.debug.store());

async function ledAndResistor(page: Page) {
  await page.getByRole('button', { name: 'Add LED' }).click();       // LED 1: anode 1a, cathode 2a
  await page.getByRole('button', { name: 'Add Resistor' }).click();  // Resistor 1 at 3a
  // move the resistor so one leg is in the LED's cathode column: 3a → 3b → 2b (legs 2b, 6b); left first would hit the LED
  await page.getByRole('button', { name: 'Move down' }).click();
  await page.getByRole('button', { name: 'Move left' }).click();
  await expect(page.getByTestId('part-window')).toContainText('2b');
}
async function connect(page: Page, from: string, to: string) {
  await page.getByRole('combobox', { name: 'From' }).selectOption(from);
  await page.getByRole('combobox', { name: 'To' }).selectOption(to);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
}
async function expectBlinkLights(page: Page) {
  await runSketch(page, BLINK_CODE);
  await expect.poll(async () => { const s = await store(page); return s.pinHigh && (s.circuitState?.parts.led1?.brightness ?? 0) > 0.5; }, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => pin13(page), { timeout: 10_000 }).toBe(false);
}

test.describe('Build: wiring', () => {
  test.describe.configure({ timeout: 120_000 });

  test('build Blink from scratch with the table', async ({ page }) => {
    await openBuild(page);
    await ledAndResistor(page);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.D13', 'bb.1c');
    await connect(page, 'bb.6c', 'uno.GND');
    await expect(page.getByRole('list', { name: 'Connections' }).getByRole('listitem')).toHaveCount(2);
    await expectBlinkLights(page);
  });

  test('build Blink by dragging wires in 3D', async ({ page }) => {
    await openBuild(page);
    await ledAndResistor(page);
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const pin = (ref: string) => page.evaluate((r) => (window as unknown as { __rq: { debug: { buildPinScreen(r: string): { x: number; y: number } } } }).__rq.debug.buildPinScreen(r), ref);
    for (const [from, to] of [['uno.D13', 'bb.1c'], ['bb.6c', 'uno.GND']]) {
      const a = await pin(from), b = await pin(to);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
    }
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await expect(page.getByRole('list', { name: 'Connections' }).getByRole('listitem')).toHaveCount(2);
    await expectBlinkLights(page);
  });

  test('a duplicate connection shows a message', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.D13', 'bb.1c');
    await connect(page, 'bb.1c', 'uno.D13');
    await expect(page.getByRole('status').filter({ hasText: 'already connected' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Connections' }).getByRole('listitem')).toHaveCount(1);
  });
});

test.describe('Build: burns and warnings', () => {
  test.describe.configure({ timeout: 120_000 });

  test('an LED without a resistor burns, and Replace part brings it back', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('button', { name: 'Add LED' }).click(); // anode 1a, cathode 2a
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.D13', 'bb.1c');
    await connect(page, 'bb.2c', 'uno.GND');
    await runSketch(page, BLINK_CODE);
    const card = page.getByTestId('burn-card');
    await expect(card).toContainText('The LED burnt out', { timeout: 10_000 });
    await page.getByTestId('code-card').getByRole('button', { name: 'Stop' }).click();
    await card.getByRole('button', { name: 'Replace part' }).click();
    await expect(card).toBeHidden();
    const parts = await page.evaluate(() => (window as unknown as { __rq: { debug: { store(): { circuitState: { parts: Record<string, { burnt?: boolean }> } | null } } } }).__rq.debug.store().circuitState?.parts ?? {});
    expect(parts.led1?.burnt).toBeFalsy();
  });

  test('wiring 5V to GND warns before Run, and running shorts the board', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.5V', 'uno.GND');
    await expect(page.getByRole('list', { name: 'Wiring warnings' })).toContainText('5 V and GND are connected');
    await runSketch(page, BLINK_CODE);
    await expect(page.getByTestId('burn-card')).toContainText('Short circuit', { timeout: 10_000 });
    await expect(page.getByTestId('status')).toHaveText('Program stopped');
    await expect(page.getByTestId('burn-card').getByRole('button', { name: 'Replace board' })).toBeVisible();
  });
});

test('review fix: Home and Build each keep their own program; Build has no "show current" shortcut', async ({ page }) => {
  await openBuild(page);
  await expect(page.getByRole('toolbar', { name: /3D view/ }).getByRole('button', { name: /current/i })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Code' }).click();
  await page.getByRole('textbox', { name: 'Sketch code' }).fill('void setup() {\n  pinMode(13, OUTPUT)\n}\n\nvoid loop() {\n}\n'); // a mistake
  await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('list', { name: 'Compiler messages' })).toBeVisible({ timeout: 40_000 });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Home' }).click();
  const home = await page.evaluate(() => (window as unknown as { __rq: { debug: { store(): { code: string; diagnostics: unknown[]; program: { hex: string } } } } }).__rq.debug.store());
  expect(home.code).toContain('digitalWrite(13, HIGH);'); // Home's Blink, not the build's code
  expect(home.diagnostics).toEqual([]);                   // the build's errors stay with the build
  await expect(page.getByRole('toolbar', { name: /3D view/ }).getByRole('button', { name: /current/i })).toHaveCount(1);
});

test.describe('review fix: touch — quick drags orbit, press-and-hold starts a wire', () => {
  test.use({ hasTouch: true });

  test('a quick finger drag over the breadboard makes no wire; holding first does', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough for the gesture');
    await openBuild(page);
    const pin = (ref: string) => page.evaluate((r) => (window as unknown as { __rq: { debug: { buildPinScreen(r: string): { x: number; y: number } } } }).__rq.debug.buildPinScreen(r), ref);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const glide = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
      for (let i = 1; i <= 10; i++) await touch('touchMove', { x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 });
    };
    const wires = () => page.evaluate(() => (window as unknown as { __rq: { debug: { build(): { wires: unknown[] } } } }).__rq.debug.build().wires.length);

    let a = await pin('uno.D13'), b = await pin('bb.1c');
    await touch('touchStart', a); await glide(a, b); await touch('touchEnd');  // quick drag: the camera's
    await page.waitForTimeout(300);
    expect(await wires()).toBe(0);

    a = await pin('uno.D13'); b = await pin('bb.1c');                         // the camera may have moved
    await touch('touchStart', a); await page.waitForTimeout(450); await glide(a, b); await touch('touchEnd');
    await expect.poll(wires).toBe(1);
  });
});

test.describe('B3: the build as it really is', () => {
  test.describe.configure({ timeout: 120_000 });
  const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name }).click();

  test('the build is still there after closing and reopening the page', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('button', { name: 'Add LED' }).click();
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.D13', 'bb.1c');
    await page.reload();
    await nav(page, 'Build');
    await expect(page.getByRole('list', { name: 'On the bench' })).toContainText('LED 1');
    expect((await build(page)).wires).toHaveLength(1);
  });

  test('a partly damaged save opens with what is still good', async ({ page }) => {
    await page.goto('/?test');
    await page.evaluate(() => localStorage.setItem('rq-build-v1', JSON.stringify({ v: 1, code: 'void setup() {}\nvoid loop() {}\n', inputs: 3,
      parts: [{ id: 'led1', type: 'led', params: {}, at: { col: 4, row: 'b' } }, { id: 'zz1', type: 'warp-drive', params: {}, at: { col: 1, row: 'a' } }],
      wires: [{ id: 'w1', from: 'uno.D13', to: 'bb.4d', color: '#000' }, { id: 'w2', from: 'uno.D77', to: 'bb.9d', color: '#000' }] })));
    await page.reload();
    await nav(page, 'Build');
    await expect(page.getByRole('list', { name: 'On the bench' })).toContainText('LED 1');
    expect((await build(page)).parts).toHaveLength(1);
    expect((await build(page)).wires).toHaveLength(1);
  });

  test('the board has power while stopped: an LED on 5 V through 220 Ω lights without Run', async ({ page }) => {
    await openBuild(page);
    await ledAndResistor(page);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.5V', 'bb.1c');
    await connect(page, 'bb.6c', 'uno.GND'); // the resistor's far leg is at 6b
    await expect.poll(async () => (await store(page)).circuitState?.parts.led1?.brightness ?? 0, { timeout: 10_000 }).toBeGreaterThan(0.3);
    await expect(page.getByTestId('status')).toHaveText('Program stopped');
  });

  test('a burnt LED is still burnt after visiting Home and coming back', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('button', { name: 'Add LED' }).click();
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await connect(page, 'uno.D13', 'bb.1c');
    await connect(page, 'bb.2c', 'uno.GND');
    await runSketch(page, BLINK_CODE);
    await expect(page.getByTestId('burn-card')).toContainText('The LED burnt out', { timeout: 10_000 });
    await nav(page, 'Home');
    await nav(page, 'Build');
    await expect(page.getByTestId('burn-card')).toContainText('The LED burnt out');
  });

  test('a refused action says why, whichever tab is open', async ({ page }) => {
    await openBuild(page);
    await page.getByRole('tab', { name: 'Code' }).click();
    await dbg(page, 'addWire', 'uno.D13', 'uno.D13');
    await expect(page.getByRole('status').filter({ hasText: /two different ends/ })).toBeVisible();
  });
});
