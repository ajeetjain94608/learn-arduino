import { expect, test } from '@playwright/test';

test('the Uno board matches the approved look', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one baseline size is enough for the board');
  await page.goto('/?test&view=board&theme=lab');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await page.addStyleTag({ content: '.viewer > :not(.workbench) { visibility: hidden !important; }' }); // 3D only
  await page.waitForTimeout(1500); // textures uploaded, camera damping settled
  await expect(page.locator('canvas[data-engine]')).toHaveScreenshot('board-lab.png', { maxDiffPixelRatio: 0.02 });
});
