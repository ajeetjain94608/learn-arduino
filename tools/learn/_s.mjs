import { chromium } from '@playwright/test';
import fs from 'node:fs';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
const ids = process.argv.slice(2);
for (const id of ids) {
  await p.goto('http://localhost:5180/?test#/projects/' + id + '/build');
  await p.getByRole('tab', { name: 'Wiring' }).click();
  await p.waitForTimeout(400);
  const svg = await p.locator('.schem__sheet svg').evaluate((e) => { e.setAttribute('width', e.viewBox.baseVal.width); e.setAttribute('height', e.viewBox.baseVal.height); return new XMLSerializer().serializeToString(e); });
  fs.writeFileSync('C:/Users/jaina/AppData/Local/Temp/claude/C--Users-jaina-Desktop-Build-Robot/bb1166d3-cdf2-48b4-8ec7-b6c46c6c00a1/scratchpad/sch-' + id + '.svg', svg);
}
const css = '.schem__wire{stroke:#14202E;stroke-width:1.8;fill:none}text{fill:#14202E;stroke:none;font-family:sans-serif}.schem__pin{font-size:11px}.schem__name{font-size:12px;font-weight:800}.schem__net{font-size:11px;font-weight:800}.schem__pinname{font-size:10px;opacity:.7}.schem__hit{fill:transparent;stroke:none}.schem__chip{fill:#fff}.schem__dot,.schem__on{fill:#14202E}.schem__off{fill:#fff}';
const html = '<style>' + css + '</style><body style="margin:0;background:#fff;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">' + ids.map((id) => '<div style="border:1px solid #ccc"><b>' + id + '</b>' + fs.readFileSync('C:/Users/jaina/AppData/Local/Temp/claude/C--Users-jaina-Desktop-Build-Robot/bb1166d3-cdf2-48b4-8ec7-b6c46c6c00a1/scratchpad/sch-' + id + '.svg', 'utf8').replace('<svg', '<svg style="width:100%;height:auto;max-height:560px"') + '</div>').join('') + '</body>';
await p.setViewportSize({ width: 1800, height: 900 });
await p.setContent(html);
await p.screenshot({ path: 'C:/Users/jaina/AppData/Local/Temp/claude/C--Users-jaina-Desktop-Build-Robot/bb1166d3-cdf2-48b4-8ec7-b6c46c6c00a1/scratchpad/sch-all4.png', fullPage: true });
await b.close();
