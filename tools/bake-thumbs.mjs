// Bakes project-card pictures to src/assets/thumbs/*.png using the running dev server.
// Usage: npm run dev (in another terminal), then: npm run bake:thumbs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5180/tools/bake-thumbs.html');
await page.waitForFunction(() => window.__thumbs, null, { timeout: 60000 });
const thumbs = await page.evaluate(() => window.__thumbs);
await browser.close();
mkdirSync('src/assets/thumbs', { recursive: true });
for (const [name, dataUrl] of Object.entries(thumbs)) {
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(`src/assets/thumbs/${name}.png`, bytes);
  console.log(`wrote src/assets/thumbs/${name}.png (${bytes.length} bytes)`);
}
