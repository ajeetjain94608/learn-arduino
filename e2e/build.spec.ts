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
