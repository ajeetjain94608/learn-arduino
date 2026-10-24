import { expect, test, type Page } from '@playwright/test';

// In ?test mode the WebGL canvas keeps its drawing buffer so pixels can be read back.
async function canvasStats(page: Page) {
  return page.evaluate(() => {
    const src = document.querySelector('canvas[data-engine]') as HTMLCanvasElement | null;
    if (!src) return null;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 40;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0, 64, 40);
    const d = ctx.getImageData(0, 0, 64, 40).data;
    const colours = new Set<string>();
    for (let i = 0; i < d.length; i += 4) colours.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    const r = src.getBoundingClientRect();
    return { distinctColours: colours.size, cssW: Math.round(r.width), cssH: Math.round(r.height) };
  });
}

test('the 3D workbench renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await expect.poll(async () => (await canvasStats(page))?.distinctColours ?? 0).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('the canvas follows viewport changes (rotation / resize)', async ({ page }) => {
  await page.setViewportSize({ width: 1036, height: 647 });
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => { const s = await canvasStats(page); return s && `${s.cssW}x${s.cssH}`; }).toBe('844x390');
});

type RenderInfo = { tier: string; samples: number[]; surfacePx: number };
const renderInfo = (page: Page) => page.evaluate(() => (window as unknown as { __rq?: { debug: { render?: RenderInfo } } }).__rq?.debug.render ?? null);

test('only the scene buffer is multisampled (saves GPU memory on phones)', async ({ page }) => {
  await page.goto('/?test&quality=desktop');
  await expect.poll(() => renderInfo(page)).toMatchObject({ tier: 'desktop', samples: [0, 4], surfacePx: 36 });
});

test('the low tier can be forced and reaches the renderer and the board texture', async ({ page }) => {
  await page.goto('/?test&quality=low');
  await expect.poll(() => renderInfo(page)).toMatchObject({ tier: 'low', samples: [0, 0], surfacePx: 24 });
});
