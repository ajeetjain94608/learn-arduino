import { expect, test, type Page } from '@playwright/test';

type Frame = { simMs: number; pin13: boolean; line: number | null; bootLed: boolean; running: boolean };
type Debug = { sim?: { simMs: number; pin13: boolean; speed: number }; store(): Record<string, unknown> & { line: number | null; bootLed: boolean; running: boolean; resetBoard(): void }; loadProgram?(name: string): void };
const debug = (page: Page) => page.evaluate(() => Boolean((window as unknown as { __rq?: { debug: Debug } }).__rq?.debug.sim));

// Records one sample per animation frame inside the page (independent of how fast the test machine is).
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __rq: { debug: Debug }; __frames: Frame[] };
    w.__frames = [];
    const tick = () => {
      const d = w.__rq.debug, s = d.store();
      if (d.sim) w.__frames.push({ simMs: d.sim.simMs, pin13: d.sim.pin13, line: s.line, bootLed: s.bootLed, running: s.running });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);

async function runBlink(page: Page) {
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  await record(page);
  await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
  await expect(page.getByTestId('status')).toHaveText('Uploading…');
  await expect.poll(() => debug(page)).toBe(true);
}

test.describe('the simulated board runs the real program', () => {
  test.describe.configure({ timeout: 60_000 });

  test('Run: after upload, pin 13 toggles about every second for real', async ({ page }) => {
    await runBlink(page);
    await expect.poll(async () => (await frames(page)).filter((f) => f.running).at(-1)?.simMs ?? 0, { timeout: 30_000 }).toBeGreaterThan(3500);
    const fs = (await frames(page)).filter((f) => f.running && f.simMs > 0);
    const edges: number[] = [];
    for (let i = 1; i < fs.length; i++) if (fs[i].pin13 !== fs[i - 1].pin13) edges.push(fs[i].simMs);
    expect(edges.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < edges.length; i++) expect(Math.abs(edges[i] - edges[i - 1] - 1000)).toBeLessThanOrEqual(150);
  });

  test("serial monitor shows the board's own output", async ({ page }) => {
    await runBlink(page);
    const monitor = page.getByRole('log', { name: 'Serial monitor' });
    await expect(monitor).toContainText('LED on', { timeout: 15_000 });
    await expect(monitor).toContainText('LED off', { timeout: 15_000 });
    const text = await monitor.innerText();
    expect(text.indexOf('LED on')).toBeLessThan(text.indexOf('LED off'));
  });

  test('the running line follows the program', async ({ page }) => {
    await runBlink(page);
    await expect.poll(async () => (await frames(page)).filter((f) => f.running).at(-1)?.simMs ?? 0, { timeout: 30_000 }).toBeGreaterThan(2500);
    const fs = (await frames(page)).filter((f) => f.running && f.simMs > 100);
    const share = (pin: boolean, line: number) => { const xs = fs.filter((f) => f.pin13 === pin); return xs.filter((f) => f.line === line).length / xs.length; };
    expect(share(true, 9)).toBeGreaterThan(0.9);
    expect(share(false, 12)).toBeGreaterThan(0.9);
    await expect(page.locator('.code__line.is-running')).toHaveCount(1);
  });

  test('reset restarts the program', async ({ page }) => {
    await runBlink(page);
    const monitor = page.getByRole('log', { name: 'Serial monitor' });
    await expect(monitor).toContainText('LED on', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.evaluate(() => (window as unknown as { __rq: { debug: Debug } }).__rq.debug.store().resetBoard());
    await expect(page.getByTestId('status')).toHaveText('Resetting…');
    await expect(monitor).toContainText('LED on', { timeout: 15_000 });
    expect((await frames(page)).some((f) => f.bootLed)).toBe(true); // the bootloader's L flashes were shown
  });

  test('typing in the serial input reaches the board', async ({ page }) => {
    await page.goto('/?test');
    await expect(page.locator('canvas[data-engine]')).toBeVisible();
    await page.evaluate(() => (window as unknown as { __rq: { debug: Debug } }).__rq.debug.loadProgram!('echo'));
    await expect.poll(() => debug(page), { timeout: 15_000 }).toBe(true);
    await expect(page.getByTestId('status')).not.toHaveText(/Uploading|Resetting/, { timeout: 15_000 });
    const input = page.getByRole('textbox', { name: 'Message to the board' });
    await input.fill('hi');
    await page.getByRole('button', { name: 'Send to board' }).click();
    await expect(page.getByRole('log', { name: 'Serial monitor' })).toContainText('HI', { timeout: 10_000 });
  });
});
