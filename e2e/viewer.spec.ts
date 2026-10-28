import { expect, test } from '@playwright/test';

// The same controls in the corner of every page's 3D view: the table map and Current / Labels / Sound.
for (const [name, url] of [['Home (Blink)', '/?test'], ['a project', '/?test#/projects/button'], ['Build', '/?test#/build'], ['a component', '/?test#/components/led']] as const) {
  test(`${name}: Current, Labels and Sound and the table map are there`, async ({ page }) => {
    await page.goto(url);
    const options = page.getByRole('toolbar', { name: 'View options' });
    for (const n of ['Current', 'Labels', 'Sound']) await expect(options.getByRole('button', { name: n })).toBeVisible();
    await expect(page.getByTestId('minimap')).toBeVisible();
    for (const b of await options.getByRole('button').all()) { const box = (await b.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(47); expect(box.height).toBeGreaterThanOrEqual(47); }
  });
}

test('tapping the map sends the camera to that spot, zoomed in', async ({ page }) => {
  await page.goto('/?test#/build');
  await page.waitForFunction(() => (window as unknown as { __rq?: { debug?: { build?: unknown; camera?: unknown } } }).__rq?.debug?.camera);
  await page.evaluate(() => (window as unknown as { __rq: { debug: { build(): { addPart(t: string): string } } } }).__rq.debug.build().addPart('hcsr04'));
  const zoom = () => page.evaluate(() => (window as unknown as { __rq: { debug: { camera(): { zoom: number } } } }).__rq.debug.camera().zoom);
  const before = await zoom();
  const map = page.getByTestId('minimap');
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.9, y: box.height * 0.5 } });
  await expect.poll(zoom, { timeout: 5000 }).toBeGreaterThan(before * 1.1);
});

test('Current on a project shows dots on the wires while the board has power and something draws current', async ({ page }) => {
  await page.goto('/?test#/projects/servo');
  const dots = () => page.evaluate(() => (window as unknown as { __rq?: { debug?: { electronsVisible?: boolean } } }).__rq?.debug?.electronsVisible);
  await expect.poll(dots, { timeout: 15_000 }).toBe(false);   // not asked for yet
  await page.getByRole('toolbar', { name: 'View options' }).getByRole('button', { name: 'Current' }).click();
  await expect.poll(dots, { timeout: 15_000 }).toBe(true);    // the servo is powered from the 5 V wire
  await page.getByRole('toolbar', { name: 'View options' }).getByRole('button', { name: 'Current' }).click();
  await expect.poll(dots, { timeout: 15_000 }).toBe(false);
});

test('Run plugs the USB cable into the board first, then uploads; the board has no power before', async ({ page }) => {
  await page.goto('/?test&nousb#/projects/blink');
  await page.waitForFunction(() => (window as unknown as { __rq?: { debug?: { store?: unknown } } }).__rq?.debug?.store);
  const usb = () => page.evaluate(() => (window as unknown as { __rq: { debug: { store(): { usb: boolean } } } }).__rq.debug.store().usb);
  const plugged = () => page.evaluate(() => (window as unknown as { __rq: { debug: { usbProgress?: number } } }).__rq.debug.usbProgress);
  expect(await usb()).toBe(false);
  await page.getByTestId('code-card').getByRole('button', { name: 'Run' }).click();
  await expect(page.getByTestId('status')).toHaveText('Plugging in the USB cable…');
  await expect.poll(usb).toBe(true);
  await expect(page.getByTestId('status')).not.toHaveText('Plugging in the USB cable…', { timeout: 5000 });
  await expect.poll(plugged, { timeout: 5000 }).toBe(1);
});
