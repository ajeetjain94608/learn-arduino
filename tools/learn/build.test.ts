// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../../src/content/projects';
import { TUTORIALS } from '../../src/content/tutorials';
import { build, imageSize, loadArticles, PARTS } from './build.mjs';

describe('the tutorials', () => {
  const all = loadArticles();
  it('every article has a title, a short description, a known kind, and only known parts', () => {
    for (const a of all) {
      expect(a.title.length, a.slug).toBeGreaterThan(10);
      expect(a.description.length, a.slug).toBeLessThanOrEqual(165);
      for (const p of a.parts ?? []) expect(PARTS[p], `${a.slug}: ${p}`).toBeDefined();
    }
  });
  it('the projects they name exist, and the app links back to each of them', () => {
    for (const a of all.filter((x) => x.project)) {
      expect(PROJECTS.some((p) => p.id === a.project), a.slug).toBe(true);
      expect(TUTORIALS[a.project], `src/content/tutorials.ts lists ${a.project}`).toBe(a.slug);
    }
    for (const [project, slug] of Object.entries(TUTORIALS)) expect(all.some((a) => a.slug === slug && a.project === project), slug).toBe(true);
  });
  it('"read next" and inside links point at tutorials that exist; pictures exist', () => {
    const slugs = new Set(all.map((a) => a.slug));
    for (const a of all) {
      for (const r of a.related ?? []) expect(slugs.has(r), `${a.slug} → ${r}`).toBe(true);
      for (const [, s] of a.body.matchAll(/\]\(\/learn\/([^/)]+)\/\)/g)) expect(slugs.has(s), `${a.slug} links ${s}`).toBe(true);
      for (const [, f] of a.body.matchAll(/!\[[^\]]*\]\(img\/([^)\s]+)/g)) expect(fs.existsSync(path.join('content/learn/img', f)), `${a.slug}: ${f}`).toBe(true);
      for (const f of [a.image, a.og].filter(Boolean)) expect(fs.existsSync(path.join('content/learn/img', f)), `${a.slug}: ${f}`).toBe(true);
    }
  });
  it('builds pages ready for search engines and sharing', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
    build(out);
    const html = fs.readFileSync(path.join(out, 'learn/blink-an-led/index.html'), 'utf8');
    expect(html).toContain('<link rel="canonical" href="https://learnarduino.tech/learn/blink-an-led/" />');
    expect(html).toContain('<meta property="og:image" content="https://learnarduino.tech/learn/img/blink-og.jpg" />');
    expect(html).toContain('"@type":"TechArticle"');
    expect(html).toContain('data-src="/?embed#/projects/blink"');           // the project, live in 3D
    // the only script from elsewhere is AdSense's (non-personalized), on tutorial pages only
    expect([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])).toEqual(['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8562469101558842']);
    expect(html).toContain('requestNonPersonalizedAds = 1');
    expect(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8')).toContain('https://learnarduino.tech/learn/what-is-a-breadboard/');
    expect(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8')).toContain('Sitemap: https://learnarduino.tech/sitemap.xml');
    fs.rmSync(out, { recursive: true, force: true });
  });
  it('reads picture sizes from PNG and JPEG', () => {
    expect(imageSize(fs.readFileSync('content/learn/img/blink-og.jpg'))).toEqual({ w: 1200, h: 630 });
    expect(imageSize(fs.readFileSync('src/assets/components/led.png'))?.w).toBeGreaterThan(0);
  });
});

describe('search features', () => {
  it('the FAQ for Google comes from "Questions people ask"', async () => {
    const { faqOf, shortTitle } = await import('./build.mjs');
    const faq = faqOf('## Intro\n\ntext\n\n## Questions people ask\n\n### Can I use pin 12?\nYes — any pin from **2** to 13.\n\n### Why 220 Ω?\nIt limits the [current](/x/).\n\n## What\'s next\n\nmore\n');
    expect(faq).toEqual([{ q: 'Can I use pin 12?', a: 'Yes — any pin from 2 to 13.' }, { q: 'Why 220 Ω?', a: 'It limits the current.' }]);
    expect(shortTitle("What is Arduino? A beginner's guide")).toBe('What is Arduino?');
    expect(shortTitle('Blink an LED with Arduino — your first circuit')).toBe('Blink an LED with Arduino');
  });
  it('every article has a quiz and questions people ask', () => {
    for (const a of loadArticles()) {
      expect(a.body, a.slug).toContain('::: quiz');
      expect(a.body, a.slug).toContain('## Questions people ask');
    }
  });
});
