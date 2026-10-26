import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name, exact: true }).click();
type Build = { parts: { id: string; type: string }[]; wires: unknown[] };
const build = (page: Page) => page.evaluate(() => (window as unknown as { __rq: { debug: { build(): Build } } }).__rq.debug.build());

test.beforeEach(async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
});

test.describe('Projects', () => {
  test('the Projects page lists all 16; opening one opens it on Home, with its own circuit, labels and cards', async ({ page }) => {
    await nav(page, 'Projects');
    const list = page.getByRole('list', { name: 'Projects' });
    await expect(list.locator(':scope > li')).toHaveCount(16);
    await page.getByRole('button', { name: 'Open Night light' }).click();
    await expect(page).toHaveURL(/#\/projects\/night-light$/);
    await expect(page.getByTestId('explorer-screen')).toBeVisible();
    await expect(page.getByTestId('info-card').getByRole('heading', { name: 'Night light' })).toBeVisible();
    await expect(page.getByTestId('code-card')).toContainText('const int DARK = 400;');
    await expect(page.locator('[data-hotspot="ldr"]')).toBeVisible();        // the labels, like Blink's
    expect((await build(page)).parts.map((p) => p.type).sort()).toEqual(['ldr', 'led', 'resistor', 'resistor']);
  });

  test("Home's project strip opens every project right on Home, the way Blink does", async ({ page }) => {
    const strip = page.getByTestId('projects');
    await strip.scrollIntoViewIfNeeded();
    await strip.getByRole('button', { name: /Mini piano/ }).click();
    await expect(page).toHaveURL(/#\/projects\/piano$/);
    await expect(page.getByTestId('explorer-screen')).toBeVisible();
    await expect(page.getByTestId('info-card').getByRole('heading', { name: 'Mini piano' })).toBeVisible();
    await expect(strip.getByRole('button', { name: /Mini piano/ })).toHaveClass(/is-on/);
    await strip.getByRole('button', { name: /Blink an LED/ }).click();     // and back to Blink, without leaving Home
    await expect(page.getByTestId('explorer-screen')).toBeVisible();
    await expect(page.locator('[data-hotspot="led"]')).toBeVisible();
  });

  test("Edit in Build opens the project's own Build page; its changes stay apart from your build, and Reset brings the original back", async ({ page }) => {
    await page.goto('/?test#/projects/knob');
    await page.getByTestId('info-card').getByRole('button', { name: 'Edit in Build' }).click();
    await expect(page).toHaveURL(/#\/projects\/knob\/build$/);
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await page.getByRole('button', { name: /^Delete/ }).first().click();
    expect((await build(page)).wires).toHaveLength(4);
    await nav(page, 'Build');
    expect((await build(page)).parts).toEqual([]);   // the free build is untouched
    await page.goBack();
    expect((await build(page)).wires).toHaveLength(4); // the project kept the change
    await page.getByRole('tab', { name: 'About' }).click();
    await page.getByRole('button', { name: 'Reset project' }).click();
    await page.getByRole('button', { name: 'Yes, start over' }).click();
    expect((await build(page)).wires).toHaveLength(5);
  });
});

test.describe('Components', () => {
  test('the Components page groups every part; a part opens with its tabs, in 3D', async ({ page }) => {
    await nav(page, 'Components');
    for (const g of ['The board', 'Basics', 'Lights, sound and motion', 'Sensors']) await expect(page.getByRole('region', { name: g })).toBeVisible();
    await page.getByRole('button', { name: 'Open Servo' }).click();
    await expect(page).toHaveURL(/#\/components\/servo$/);
    await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
    for (const tab of ['Overview', 'Pins', 'Specifications', 'Example']) await page.getByRole('tab', { name: tab }).click();
    await expect(page.locator('.component-info__code')).toContainText('arm.attach(9)');
    await expect(page.getByRole('button', { name: 'Sweep a servo' })).toBeVisible(); // used in
  });

  test('"Use it in my build" puts the part on your bench in Build', async ({ page }) => {
    await page.goto('/?test#/components/ldr');
    await page.getByRole('button', { name: 'Use it in my build' }).click();
    await expect(page).toHaveURL(/#\/build$/);
    await expect(page.getByRole('list', { name: 'On the bench' })).toContainText('Light sensor 1');
  });
});

test.describe('addresses and Reset (review fixes)', () => {
  test('a broken or unknown address shows the list, and the address is corrected', async ({ page }) => {
    await page.goto('/?test#/projects/%E0%A4%A');
    await expect(page.getByTestId('projects-screen')).toBeVisible();
    await page.goto('/?test#/projects/nope');
    await page.reload();
    await expect(page.getByTestId('projects-screen')).toBeVisible();
    await expect(page).toHaveURL(/#\/projects$/);
    await page.goto('/?test#/components/warp-drive');
    await page.reload();
    await expect(page.getByTestId('components-screen')).toBeVisible();
    await expect(page).toHaveURL(/#\/components$/);
  });

  test('Reset project (on Home) also clears what burnt: the burnt LED does not come back', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?test#/projects/knob');
    await page.reload();
    await expect(page.getByTestId('info-card').getByRole('heading', { name: 'Turn a knob' })).toBeVisible();
    await page.evaluate(() => { // the classic mistake: no resistor, ground straight on the LED's cathode
      const b = (window as unknown as { __rq: { debug: { build(): { removePart(id: string): void; addWire(a: string, b: string): unknown } } } }).__rq.debug.build();
      b.removePart('resistor1');
      b.addWire('bb.16a', 'uno.GND');
    });
    await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
    await expect(page.getByTestId('burn-card')).toContainText('The LED burnt out', { timeout: 60_000 });
    await page.getByTestId('info-card').getByRole('button', { name: 'Reset project' }).click();
    await page.getByTestId('info-card').getByRole('button', { name: 'Yes, start over' }).click();
    await expect(page.getByTestId('burn-card')).toBeHidden();
    await page.waitForTimeout(2500); // long enough for a stale burn to be sent back from the simulator
    await expect(page.getByTestId('burn-card')).toBeHidden();
    expect((await build(page)).parts.map((p) => p.id).sort()).toEqual(['led1', 'pot1', 'resistor1']);
  });
});

test.describe('every project on Home', () => {
  test('all 16 open on Home with their labels, their own cards and no errors', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough to visit them all');
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const ids = ['board', 'blink', 'button', 'knob', 'rgb', 'night-light', 'distance', 'tune', 'piano', 'motor', 'thermostat', 'servo', 'wheel', 'plant', 'strength', 'parking'];
    const titles = ['UNO R3 board', 'Blink an LED', 'Push a button', 'Turn a knob', 'Mix colours', 'Night light', 'Measure distance', 'Play a tune', 'Mini piano', 'Control a motor', 'Thermostat', 'Sweep a servo', 'Spin the wheel', 'Smart plant', 'Strength tester', 'Parking sensor'];
    for (const [i, id] of ids.entries()) {
      await page.goto('/?test#/projects/' + id);
      await page.reload();
      await expect(page.getByTestId('explorer-screen'), id).toBeVisible();
      await expect(page.getByTestId('info-card').getByRole('heading', { name: titles[i] }), id).toBeVisible();
      await expect(page.locator('[data-hotspot]:visible').first(), id).toBeVisible({ timeout: 15_000 });
      expect(await page.locator('[data-hotspot]:visible').count(), id + ': labels shown').toBeGreaterThanOrEqual(2);
    }
    expect(errors).toEqual([]);
  });

  test('pointing at a part names it, like the LED in Blink', async ({ page }) => {
    await page.goto('/?test#/projects/distance');
    await page.reload();
    await expect(page.locator('[data-hotspot="hcsr04"]')).toBeVisible({ timeout: 15_000 });
    const at = await page.evaluate(() => (window as unknown as { __rq: { debug: { partScreenPos(id: string): { x: number; y: number } | null } } }).__rq.debug.partScreenPos('hcsr041'));
    expect(at).not.toBeNull();
    await page.mouse.move(at!.x, at!.y);
    await page.mouse.move(at!.x + 2, at!.y + 2);
    await expect(page.getByTestId('part-tooltip')).toContainText('Distance sensor');
  });

  test('the circuit builds itself: parts drop in one by one, wires draw, then the labels appear', async ({ page }) => {
    await page.goto('/?test&anim#/projects/knob');
    await page.reload();
    const built = () => page.evaluate(() => (window as unknown as { __rq?: { debug?: { assembly?: { built: number } } } }).__rq?.debug?.assembly?.built ?? 0);
    await expect.poll(built, { timeout: 15_000 }).toBeGreaterThan(0);          // it starts…
    await expect(page.locator('[data-hotspot="led"]')).toBeHidden();             // labels wait for the build
    await expect.poll(built, { timeout: 15_000 }).toBe(8);                       // 3 parts + 5 wires
    await expect(page.locator('[data-hotspot="led"]')).toBeVisible({ timeout: 10_000 });
  });
});
