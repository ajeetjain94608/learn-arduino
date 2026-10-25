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
    await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off');
    await page.getByTestId('viewer').scrollIntoViewIfNeeded();
    const c = (await partScreen(page, 'button1'))!;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect(page.getByTestId('status')).toHaveText('Pin 13 HIGH · LED on', { timeout: 10_000 });
    await page.mouse.up();
    await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off', { timeout: 10_000 });
  });
});

const BLINK_CODE = 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n';
type Snap = { pinHigh: boolean; circuitState: { parts: Record<string, { brightness?: number }> } | null };
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
  await expect(page.getByTestId('status')).toHaveText('Pin 13 LOW · LED off', { timeout: 10_000 });
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
