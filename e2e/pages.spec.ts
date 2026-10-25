import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name, exact: true }).click();
type Build = { parts: { id: string; type: string }[]; wires: unknown[] };
const build = (page: Page) => page.evaluate(() => (window as unknown as { __rq: { debug: { build(): Build } } }).__rq.debug.build());

test.beforeEach(async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
});

test.describe('Projects', () => {
  test('the Projects page lists all 16; opening one shows it on the bench, ready', async ({ page }) => {
    await nav(page, 'Projects');
    const list = page.getByRole('list', { name: 'Projects' });
    await expect(list.locator(':scope > li')).toHaveCount(16);
    await page.getByRole('button', { name: 'Open Night light' }).click();
    await expect(page).toHaveURL(/#\/projects\/night-light$/);
    await expect(page.getByRole('heading', { name: 'Night light' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
    expect((await build(page)).parts.map((p) => p.type).sort()).toEqual(['ldr', 'led', 'resistor', 'resistor']);
    await page.getByRole('tab', { name: 'Code' }).click();
    await expect(page.getByRole('textbox', { name: 'Sketch code' })).toHaveValue(/const int DARK = 400;/);
  });

  test("a project keeps your changes apart from your own build, and Reset brings the original back", async ({ page }) => {
    await page.goto('/?test#/projects/blink');
    await expect(page.getByRole('heading', { name: 'Blink an LED' })).toBeVisible();
    await page.getByRole('tab', { name: 'Wiring' }).click();
    await page.getByRole('button', { name: /^Delete/ }).first().click();
    expect((await build(page)).wires).toHaveLength(1);
    await nav(page, 'Build');
    expect((await build(page)).parts).toEqual([]);   // the free build is untouched
    await page.goBack();
    expect((await build(page)).wires).toHaveLength(1); // the project kept the change
    await page.getByRole('tab', { name: 'About' }).click();
    await page.getByRole('button', { name: 'Reset project' }).click();
    await page.getByRole('button', { name: 'Yes, start over' }).click();
    expect((await build(page)).wires).toHaveLength(2);
  });

  test('Home lists the projects; one that is not on Home opens its page', async ({ page }) => {
    const projects = page.getByTestId('projects');
    await projects.scrollIntoViewIfNeeded();
    await projects.getByRole('button', { name: /Mini piano/ }).click();
    await expect(page).toHaveURL(/#\/projects\/piano$/);
    await expect(page.getByRole('heading', { name: 'Mini piano' })).toBeVisible();
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
