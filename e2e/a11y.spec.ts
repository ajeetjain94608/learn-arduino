import { expect, test } from '@playwright/test';

// Global constraints from the spec: tap targets ≥ 48 px, text ≥ 14 px.
test('every button is at least 48 x 48 px to tap', async ({ page }) => {
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  const small = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => getComputedStyle(b).display !== 'none' && b.offsetParent !== null)
    .map((b) => {
      const r = b.getBoundingClientRect();
      const after = getComputedStyle(b, '::after');
      const extra = after.content !== 'none' && after.position === 'absolute' ? 16 : 0; // invisible tap padding
      return { name: b.getAttribute('aria-label') ?? b.textContent?.trim(), w: Math.round(r.width + (after.content !== 'none' ? 8 : 0)), h: Math.round(r.height + extra) };
    })
    .filter((b) => b.w < 48 || b.h < 48));
  expect(small).toEqual([]);
});

test('all visible text is at least 14 px', async ({ page }) => {
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await page.waitForTimeout(800); // callouts placed
  const tiny = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (!n.textContent?.trim() || el.closest('svg') || el.offsetParent === null) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const size = parseFloat(cs.fontSize);
      if (size < 14) out.push(`${n.textContent.trim().slice(0, 24)} (${size}px)`);
    }
    return out;
  });
  expect(tiny).toEqual([]);
});
