import { expect, test } from '@playwright/test';

type Dbg = { assembly?: { t: number; built: number }; store?: () => { assembled: boolean } };
const dbg = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const d = (window as unknown as { __rq?: { debug: Dbg } }).__rq?.debug;
  return { t: d?.assembly?.t ?? null, built: d?.assembly?.built ?? null, assembled: d?.store?.().assembled ?? null };
});

test('opening a project builds its circuit part by part, then shows the labels', async ({ page }) => {
  await page.goto('/?test&anim');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  // record every frame in the page, so the check does not depend on how fast this machine is
  await page.evaluate(() => {
    const log: { built: number; assembled: boolean; label: boolean }[] = [];
    (window as unknown as { __asmLog: typeof log }).__asmLog = log;
    const tick = () => {
      const d = (window as unknown as { __rq?: { debug: Dbg } }).__rq?.debug;
      const card = document.querySelector<HTMLElement>('[data-hotspot="led"]');
      log.push({ built: d?.assembly?.built ?? 0, assembled: d?.store?.().assembled ?? false, label: !!card && card.style.display !== 'none' });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /Blink an LED/ }).click();
  await expect.poll(async () => (await dbg(page)).assembled, { timeout: 8000 }).toBe(true);
  await expect(page.locator('[data-hotspot="led"]')).toBeVisible();

  const log = await page.evaluate(() => (window as unknown as { __asmLog: { built: number; assembled: boolean; label: boolean }[] }).__asmLog);
  const seen = new Set(log.map((f) => f.built));
  for (const n of [1, 2, 3, 4]) expect(seen.has(n), `a frame with ${n} of 5 steps placed`).toBe(true); // built step by step
  for (let i = 1; i < log.length; i++) expect(log[i].built).toBeGreaterThanOrEqual(log[i - 1].built); // never goes backwards
  for (const f of log) if (f.label) expect(f.assembled, 'labels wait until the circuit is built').toBe(true);
  expect(log.at(-1)!.built).toBe(5);
});

test('without motion (tests, reduced-motion users) the circuit appears already built', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?test&anim');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await page.getByRole('button', { name: /Blink an LED/ }).click();
  await expect.poll(async () => (await dbg(page)).assembled, { timeout: 1500 }).toBe(true);
  await expect(page.locator('[data-hotspot="led"]')).toBeVisible();
});
