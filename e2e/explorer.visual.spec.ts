import { expect, test } from '@playwright/test';

const shots = [
  { name: 'explorer-circuit-lab.png', url: '/?test&hold&run&view=circuit&theme=lab' },
  { name: 'explorer-board-night.png', url: '/?test&hold&run&view=board&theme=night' },
];

for (const s of shots) {
  test(`explorer screen: ${s.name}`, async ({ page }) => {
    await page.goto(s.url);
    await expect(page.locator('canvas[data-engine]')).toBeVisible();
    await page.addStyleTag({ content: '.fps { visibility: hidden !important; }' });
    await page.waitForTimeout(1800); // camera settled, labels placed
    await expect(page).toHaveScreenshot(s.name, { maxDiffPixelRatio: 0.02 });
  });
}
