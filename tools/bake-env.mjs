// Bakes the PMREM room environment to src/three/workbench/env/room-env.bin using the running dev server.
// Usage: npm run dev (in another terminal), then: npm run bake:env
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5180/tools/bake-env.html');
await page.waitForFunction(() => window.__baked, null, { timeout: 30000 });
const { width, height, data } = await page.evaluate(() => window.__baked);
await browser.close();
mkdirSync('src/three/workbench/env', { recursive: true });
writeFileSync('src/three/workbench/env/room-env.bin', Buffer.from(new Uint16Array(data).buffer));
console.log(`wrote room-env.bin (${width}x${height}, ${data.length * 2} bytes)`);
