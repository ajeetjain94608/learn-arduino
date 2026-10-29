import { expect, test } from '@playwright/test';

// ?embed: the app inside a tutorial — only the 3D view, its own Run button and a way into the full lab.
test('the embedded 3D view shows only the project, runs it, and links to the full lab', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough');
  await page.goto('/?test&embed#/projects/blink');
  await expect(page.getByTestId('viewer').locator('canvas[data-engine]')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await expect(page.getByTestId('code-card')).toBeHidden();
  const box = (await page.getByTestId('viewer').boundingBox())!;
  expect(box.width).toBeGreaterThan(1000);                                     // the 3D fills the window
  await expect(page.getByRole('link', { name: 'Open the full 3D lab ↗' })).toHaveAttribute('href', '/#/projects/blink');
  await page.getByRole('button', { name: 'Run the code' }).click();
  await expect(page.getByTestId('status')).toHaveText(/Pin 13/, { timeout: 30_000 });
});

test('every project links to its written tutorial from Home', async ({ page }) => {
  await page.goto('/?test#/projects/distance');
  await expect(page.getByRole('link', { name: 'Read the full tutorial' })).toHaveAttribute('href', '/learn/measure-distance-hc-sr04/');
  await page.goto('/?test#/projects/tune');
  await expect(page.getByRole('link', { name: 'Read the full tutorial' })).toHaveAttribute('href', '/learn/play-a-tune-buzzer-arduino/');
});
