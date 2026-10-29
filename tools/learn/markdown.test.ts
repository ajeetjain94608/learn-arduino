// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { frontMatter, highlight, inline, readingMinutes, render, slugify } from './markdown.mjs';

describe('the tutorials\' Markdown', () => {
  it('reads front matter: text, numbers and lists', () => {
    const { data, body } = frontMatter('---\ntitle: "Blink an LED"\norder: 2\ntags: [led, basics]\n---\n# Hi\n');
    expect(data).toEqual({ title: 'Blink an LED', order: 2, tags: ['led', 'basics'] });
    expect(body).toBe('# Hi\n');
  });
  it('headings get ids and a table of contents; the same title twice gets two ids', () => {
    const r = render('# Title\n\n## How it works\n\n### The code\n\n## How it works\n');
    expect(r.html).toContain('<h1>Title</h1>');
    expect(r.toc.map((t) => t.id)).toEqual(['how-it-works', 'the-code', 'how-it-works-2']);
  });
  it('paragraphs, lists, tables and callouts', () => {
    const r = render('One\ntwo.\n\n- a\n- **b**\n\n1. x\n2. y\n\n| Pin | Does |\n|---|---|\n| D13 | LED |\n\n> **Tip:** use a resistor.\n');
    expect(r.html).toContain('<p>One two.</p>');
    expect(r.html).toContain('<ul><li>a</li><li><strong>b</strong></li></ul>');
    expect(r.html).toContain('<ol><li>x</li><li>y</li></ol>');
    expect(r.html).toContain('<td>D13</td>');
    expect(r.html).toContain('<aside class="callout callout--tip"><strong>Tip:</strong> use a resistor.</aside>');
  });
  it('escapes HTML in text and code, and colours Arduino code', () => {
    expect(inline('a < b & `x<y`')).toBe('a &lt; b &amp; <code>x&lt;y</code>');
    const r = render('```cpp\ndigitalWrite(13, HIGH); // on\n```\n');
    expect(r.html).toContain('<span class="t-f">digitalWrite</span>(<span class="t-n">13</span>, <span class="t-k">HIGH</span>);');
    expect(r.html).toContain('<span class="t-c">// on</span>');
    expect(highlight('if (a < 2) {}')).toContain('&lt;');
  });
  it('links: outside links open in a new tab, our own do not', () => {
    expect(inline('[x](https://example.com)')).toContain('rel="noopener" target="_blank"');
    expect(inline('[x](/learn/blink/)')).toBe('<a href="/learn/blink/">x</a>');
  });
  it('a picture on its own line is a figure with its caption', () => {
    const r = render('![The LED](img/led.png "It **lights**")\n', { figure: (src: string, alt: string, cap: string) => `[${src}|${alt}|${cap}]` });
    expect(r.html).toBe('[img/led.png|The LED|It **lights**]');
  });
  it('raw HTML blocks pass through; slugs and reading time', () => {
    expect(render('<svg viewBox="0 0 1 1"></svg>\n').html).toBe('<svg viewBox="0 0 1 1"></svg>');
    expect(slugify('What is a Breadboard?')).toBe('what-is-a-breadboard');
    expect(readingMinutes('word '.repeat(600))).toBe(3);
  });
});

describe('the live 3D block', () => {
  it('"::: 3d blink" becomes the project in 3D (with a caption)', () => {
    const r = render('::: 3d blink "Press Run"\n', { lab: (p: string, c: string) => `[3d ${p} ${c}]` });
    expect(r.html).toBe('[3d blink Press Run]');
    expect(render('::: 3d servo\n').html).toContain('data-src="/?embed#/projects/servo"');
  });
});
