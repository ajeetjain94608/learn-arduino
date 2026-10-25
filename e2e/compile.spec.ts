import { expect, test, type Page } from '@playwright/test';
import { BLINK } from '../src/content/sketches/blink';

type Debug = { sim?: { simMs: number; pin13: boolean } };
type Frame = { simMs: number; pin13: boolean };

async function openCode(page: Page) {
  await page.goto('/?test');
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Sketch code' });
  await editor.scrollIntoViewIfNeeded();
  return editor;
}
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __rq: { debug: Debug }; __frames: Frame[] };
    w.__frames = [];
    const tick = () => { const d = w.__rq.debug.sim; if (d) w.__frames.push({ simMs: d.simMs, pin13: d.pin13 }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const run = (page: Page) => page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();

test.describe('editing and compiling the sketch', () => {
  test.describe.configure({ timeout: 90_000 });

  test('change delay(1000) to delay(200) and the LED blinks five times faster', async ({ page }) => {
    const editor = await openCode(page);
    await editor.fill(BLINK.code.replaceAll('delay(1000)', 'delay(200)'));
    await record(page);
    await run(page);
    await expect(page.getByTestId('status')).toHaveText('Compiling…');
    await expect(page.getByTestId('status')).toHaveText('Uploading…', { timeout: 30_000 });
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)).at(-1)?.simMs ?? 0, { timeout: 30_000 }).toBeGreaterThan(1500);
    const fs = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames.filter((f) => f.simMs > 0));
    const edges: number[] = [];
    for (let i = 1; i < fs.length; i++) if (fs[i].pin13 !== fs[i - 1].pin13) edges.push(fs[i].simMs);
    expect(edges.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < edges.length; i++) expect(Math.abs(edges[i] - edges[i - 1] - 200)).toBeLessThanOrEqual(50);
  });

  test('a missing semicolon shows an error on that line with a hint, and nothing runs', async ({ page }) => {
    const editor = await openCode(page);
    await editor.fill(BLINK.code.replace('digitalWrite(13, HIGH);', 'digitalWrite(13, HIGH)'));
    await run(page);
    const errors = page.getByRole('list', { name: 'Compiler messages' });
    await expect(errors).toBeVisible({ timeout: 30_000 });
    await expect(errors.getByRole('button').first()).toContainText('Line 7');
    await expect(errors).toContainText('Each statement ends with a semicolon ;');
    await expect(page.getByTestId('status')).toHaveText('Program stopped');
    // tapping the message puts the cursor on that line
    await errors.getByRole('button').first().click();
    const caretLine = await editor.evaluate((el: HTMLTextAreaElement) => el.value.slice(0, el.selectionStart).split('\n').length);
    expect(caretLine).toBe(7);
  });

  test('unchanged project code runs instantly without compiling', async ({ page }) => {
    await openCode(page);
    await run(page);
    await expect(page.getByTestId('status')).toHaveText('Uploading…', { timeout: 1000 });
  });

  test('Blink compiles in under 2 s on desktop (after the one-time compiler download)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    const editor = await openCode(page);
    const compileOnce = async (code: string) => {
      await editor.fill(code);
      const t0 = Date.now();
      await run(page);
      await expect(page.getByTestId('status')).toHaveText('Uploading…', { timeout: 30_000 });
      const ms = Date.now() - t0;
      await page.getByTestId('code-card').getByRole('button', { name: 'Stop' }).click();
      return ms;
    };
    const cold = await compileOnce(BLINK.code.replace('delay(1000);', 'delay(998);')); // downloads + prepares the compiler
    const warm = await compileOnce(BLINK.code.replace('delay(1000);', 'delay(999);'));
    test.info().annotations.push({ type: 'compile-ms', description: `cold ${cold}, warm ${warm}` });
    expect(warm).toBeLessThan(2000);
  });
});
