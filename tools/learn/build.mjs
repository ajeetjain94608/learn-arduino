// Builds the tutorials (learnarduino.tech/learn/…) as plain, fast HTML pages from content/learn/*.md, into dist/learn — after
// `vite build` (npm run build runs it). No ads, no trackers, no scripts from other sites: each page is HTML, one stylesheet and a
// few lines of script for the share buttons.
//   node tools/learn/build.mjs [outDir=dist]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, frontMatter, inline, readingMinutes, render } from './markdown.mjs';

export const SITE = 'https://learnarduino.tech';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONTENT = path.join(ROOT, 'content/learn');
const KINDS = { project: 'Projects', component: 'Components', guide: 'Guides' };

// What a project needs (the "What you need" box). Pictures are the components' own 3D renders. Buy links come from
// content/learn/affiliate.json (part id → URL) when there are any: they are marked as sponsored, with a note saying so.
export const PARTS = {
  uno: { name: 'Arduino UNO R3 (or a compatible board)', img: 'uno' },
  usb: { name: 'USB cable (A to B)' },
  breadboard: { name: 'Half-size breadboard', img: 'breadboard' },
  jumpers: { name: 'Jumper wires (male–male)' },
  led: { name: '5 mm LED', img: 'led' },
  'resistor-220': { name: '220 Ω resistor', img: 'resistor' },
  'resistor-10k': { name: '10 kΩ resistor', img: 'resistor' },
  button: { name: 'Push button (6 mm)', img: 'button' },
  pot: { name: '10 kΩ potentiometer', img: 'pot' },
  rgb: { name: 'RGB LED (common cathode)', img: 'rgb' },
  ldr: { name: 'Light sensor (LDR)', img: 'ldr' },
  hcsr04: { name: 'HC-SR04 ultrasonic distance sensor', img: 'hcsr04' },
  buzzer: { name: 'Passive piezo buzzer', img: 'buzzer' },
  servo: { name: 'SG90 micro servo', img: 'servo' },
  motor: { name: 'Small DC motor', img: 'motor' },
  npn: { name: 'TIP120 transistor', img: 'npn' },
  diode: { name: '1N4001 diode', img: 'diode' },
  tmp36: { name: 'TMP36 temperature sensor', img: 'tmp36' },
  stepper: { name: '28BYJ-48 stepper + ULN2003 driver', img: 'stepper' },
  oled: { name: '0.96" I²C OLED display', img: 'oled' },
  soil: { name: 'Capacitive soil-moisture sensor', img: 'soil' },
  fsr: { name: 'Force-sensing resistor (FSR)', img: 'fsr' },
  traffic: { name: 'Traffic-light LED module', img: 'traffic' },
};

// --- pictures ----------------------------------------------------------------------------------------------------------
// width × height of a PNG or JPEG (so the page saves the room before the picture arrives)
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

// --- articles ----------------------------------------------------------------------------------------------------------
export function loadArticles(dir = CONTENT) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const { data, body } = frontMatter(src);
    const slug = data.slug ?? f.replace(/\.md$/, '');
    for (const k of ['title', 'description', 'kind']) if (!data[k]) throw new Error(`${f}: front matter needs "${k}"`);
    if (!KINDS[data.kind]) throw new Error(`${f}: kind must be one of ${Object.keys(KINDS).join(', ')}`);
    if (data.description.length > 165) throw new Error(`${f}: description is ${data.description.length} characters (search shows about 155)`);
    for (const p of data.parts ?? []) if (!PARTS[p]) throw new Error(`${f}: unknown part "${p}"`);
    return { ...data, slug, body, minutes: readingMinutes(body), order: data.order ?? 99 };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

const url = (slug) => `/learn/${slug}/`;
const imgUrl = (file) => `/learn/img/${file}`;
const sizeOf = (file) => { try { return imageSize(fs.readFileSync(path.join(CONTENT, 'img', file))); } catch { return null; } };
const sizeAttrs = (file) => { const s = sizeOf(file); return s ? ` width="${s.w}" height="${s.h}"` : ''; };
const partImg = (id) => (PARTS[id]?.img ? `/learn/parts/${PARTS[id].img}.png` : null);

function figure(src, alt, caption) {
  const file = src.replace(/^img\//, '');
  return `<figure><img src="${imgUrl(file)}" alt="${escapeHtml(alt)}"${sizeAttrs(file)} loading="lazy" decoding="async" />${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}</figure>`;
}

// The project, live in 3D inside the page. Until it is tapped it is only a picture (the page stays fast, nothing heavy loads);
// tapping it loads the 3D lab's own view of the project in a frame (?embed): run the code, press the parts, turn it around.
function lab(project, caption, poster = posterOf(project), alt = '') {
  const src = `/?embed#/projects/${encodeURIComponent(project)}`;
  const img = poster ? `<img src="${imgUrl(poster)}" alt="${escapeHtml(alt || caption || 'The project in 3D')}"${sizeAttrs(poster)} decoding="async" />` : '';
  const cap = caption ? `<figcaption>${inline(caption)} · <a href="/#/projects/${encodeURIComponent(project)}">open it full screen</a></figcaption>` : '';
  return `<figure class="lab3d"><div class="lab3d__frame" data-src="${src}" data-title="${escapeHtml(caption || 'The project in 3D')}">${img}<button type="button" class="lab3d__play" aria-label="Play this project in 3D"><span class="lab3d__icon" aria-hidden="true">${ICON.play}</span><span><b>Play in 3D</b><small>Run the code · press the parts · turn it around</small></span></button></div>${cap}</figure>`;
}
const posterOf = (project) => [`${project}-3d.jpg`, `${project}-hero.jpg`].find((f) => fs.existsSync(path.join(CONTENT, 'img', f)));

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  cube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
};

function shareBar(a) {
  const link = encodeURIComponent(SITE + url(a.slug)), text = encodeURIComponent(`${a.title} — free, in 3D, no hardware needed`);
  return `<div class="share" aria-label="Share this tutorial">
  <button type="button" class="share__btn share__native" data-share hidden>${ICON.share}<span>Share</span></button>
  <a class="share__btn" href="https://wa.me/?text=${text}%20${link}" rel="noopener" target="_blank">WhatsApp</a>
  <a class="share__btn" href="https://x.com/intent/post?text=${text}&amp;url=${link}" rel="noopener" target="_blank">X</a>
  <a class="share__btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${link}" rel="noopener" target="_blank">LinkedIn</a>
  <a class="share__btn" href="https://www.facebook.com/sharer/sharer.php?u=${link}" rel="noopener" target="_blank">Facebook</a>
  <button type="button" class="share__btn" data-copy="${SITE + url(a.slug)}">${ICON.link}<span>Copy link</span></button>
</div>`;
}

function tryBox(a) {
  if (!a.project) return `<a class="try" href="/#/build"><span class="try__icon">${ICON.cube}</span><span><b>Build it yourself in 3D</b><small>Free, in your browser — no board, no wires, nothing to buy.</small></span><span class="try__go">Open the 3D lab →</span></a>`;
  return `<a class="try" href="/#/projects/${encodeURIComponent(a.project)}"><span class="try__icon">${ICON.cube}</span><span><b>Try this project in 3D</b><small>Run the code, press the parts, break things safely — free, in your browser.</small></span><span class="try__go">Open in 3D →</span></a>`;
}

function partsBox(a, affiliate) {
  if (!a.parts?.length) return '';
  const any = a.parts.some((p) => affiliate[p]);
  return `<section class="parts" aria-labelledby="parts-title">
  <h2 id="parts-title">What you need</h2>
  <ul>${a.parts.map((p) => {
    const img = partImg(p), buy = affiliate[p];
    return `<li>${img ? `<img src="${img}" alt="" width="56" height="56" loading="lazy" />` : '<span class="parts__dot" aria-hidden="true"></span>'}<span>${escapeHtml(PARTS[p].name)}</span>${buy ? `<a class="parts__buy" href="${escapeHtml(buy)}" rel="sponsored nofollow noopener" target="_blank">Buy</a>` : ''}</li>`;
  }).join('')}</ul>
  <p class="parts__note">${any ? 'Some links are affiliate links: if you buy through them we may earn a small commission, at no extra cost to you. ' : ''}Don't have the parts? <a href="${a.project ? `/#/projects/${a.project}` : '/#/build'}">Build it in 3D</a> first.</p>
</section>`;
}

function card(a) {
  return `<a class="card" href="${url(a.slug)}">${a.image ? `<img src="${imgUrl(a.image)}" alt=""${sizeAttrs(a.image)} loading="lazy" decoding="async" />` : ''}<span class="card__body"><small>${KINDS[a.kind].replace(/s$/, '')}${a.level ? ` · ${a.level}` : ''} · ${a.minutes} min read</small><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.description)}</span></span></a>`;
}

function page({ title, description, canonical, ogImage, body, jsonLd, type = 'article' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${canonical}" />
<meta name="theme-color" content="#0E7C86" />
<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="Learn Arduino" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
${ogImage ? `<meta property="og:image" content="${ogImage}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n<meta name="twitter:image" content="${ogImage}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preload" href="/learn/fonts/nunito.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/learn/learn.css" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">Skip to the tutorial</a>
<header class="top">
  <a class="brand" href="/learn/"><img src="/favicon.svg" alt="" width="28" height="28" /><span>Learn Arduino <small>Tutorials</small></span></a>
  <nav aria-label="Tutorials">${Object.entries(KINDS).map(([k, v]) => `<a href="/learn/#${k}">${v}</a>`).join('')}</nav>
  <a class="top__lab" href="/">Open the 3D lab</a>
</header>
${body}
<footer class="foot">
  <p><b>Learn Arduino</b> — learn electronics by building in 3D, free. Made by Ajeet Jain.</p>
  <p class="foot__small">Not affiliated with or endorsed by Arduino. “Arduino” is a trademark of Arduino SA. Board layout based on Arduino UNO Rev3 design files (CC BY-SA 4.0).</p>
  <p class="foot__small"><a href="/learn/">All tutorials</a> · <a href="/">3D lab</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
</footer>
<script>
document.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(function () { var s = b.querySelector('span'); if (s) { s.textContent = 'Copied!'; setTimeout(function () { s.textContent = 'Copy link'; }, 1600); } }); }); });
document.querySelectorAll('.lab3d__frame').forEach(function (f) { f.addEventListener('click', function () {
  if (f.classList.contains('is-live')) return;
  var i = document.createElement('iframe'); i.src = f.dataset.src; i.title = f.dataset.title || 'The project in 3D'; i.allow = 'fullscreen';
  f.classList.add('is-live'); f.textContent = ''; f.appendChild(i); i.focus();
}); });
if (navigator.share) document.querySelectorAll('[data-share]').forEach(function (b) { b.hidden = false; b.addEventListener('click', function () { navigator.share({ title: document.title, url: location.href }).catch(function () {}); }); });
</script>
</body>
</html>
`;
}

function articlePage(a, all, affiliate) {
  const { html, toc } = render(a.body.replace(/^#\s+.*\n/, ''), { figure, lab: (p, c) => lab(p, c) });
  const same = all.filter((x) => x.kind === a.kind), i = same.indexOf(a);
  const prev = same[i - 1], next = same[i + 1];
  const related = (a.related ?? []).map((s) => all.find((x) => x.slug === s)).filter(Boolean);
  const canonical = SITE + url(a.slug);
  const ogImage = a.og ? SITE + imgUrl(a.og) : a.image ? SITE + imgUrl(a.image) : undefined;
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'TechArticle', headline: a.title, description: a.description, url: canonical,
      image: ogImage, datePublished: a.date, dateModified: a.updated ?? a.date, inLanguage: 'en', proficiencyLevel: a.level ?? 'Beginner',
      author: { '@type': 'Person', name: 'Ajeet Jain' }, publisher: { '@type': 'Organization', name: 'Learn Arduino', url: SITE },
      isAccessibleForFree: true, timeRequired: `PT${a.minutes}M`,
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tutorials', item: `${SITE}/learn/` },
      { '@type': 'ListItem', position: 2, name: KINDS[a.kind], item: `${SITE}/learn/#${a.kind}` },
      { '@type': 'ListItem', position: 3, name: a.title, item: canonical },
    ] },
  ];
  const body = `<main id="main" class="article">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/learn/">Tutorials</a> › <a href="/learn/#${a.kind}">${KINDS[a.kind]}</a> › <span>${escapeHtml(a.title)}</span></nav>
  <header class="hero">
    <p class="kicker">${a.kind === 'project' && a.number ? `Project ${a.number} · ` : ''}${escapeHtml(a.level ?? 'Beginner')} · ${a.minutes} min read${a.build ? ` · ${escapeHtml(String(a.build))} to build` : ''}</p>
    <h1>${escapeHtml(a.title)}</h1>
    <p class="lead">${inline(a.lead ?? a.description)}</p>
    ${a.project ? `<div class="hero__img">${lab(a.project, '', a.image, a.imageAlt ?? a.title)}</div>` : a.image ? `<figure class="hero__img"><img src="${imgUrl(a.image)}" alt="${escapeHtml(a.imageAlt ?? a.title)}"${sizeAttrs(a.image)} fetchpriority="high" decoding="async" /></figure>` : ''}
    ${tryBox(a)}
    ${shareBar(a)}
  </header>
  <div class="layout">
    ${toc.length > 2 ? `<nav class="toc" aria-label="On this page"><b>On this page</b><ol>${toc.filter((t) => t.level === 2).map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
    <article class="prose">
      ${partsBox(a, affiliate)}
      ${html}
      ${tryBox(a)}
      <p class="updated">Last updated ${escapeHtml(a.updated ?? a.date ?? '')}</p>
    </article>
  </div>
  ${shareBar(a)}
  ${related.length ? `<section class="more"><h2>Read next</h2><div class="cards">${related.map(card).join('')}</div></section>` : ''}
  <nav class="pager" aria-label="More ${KINDS[a.kind].toLowerCase()}">${prev ? `<a href="${url(prev.slug)}"><small>← Previous</small>${escapeHtml(prev.title)}</a>` : '<span></span>'}${next ? `<a class="pager__next" href="${url(next.slug)}"><small>Next →</small>${escapeHtml(next.title)}</a>` : ''}</nav>
</main>`;
  return page({ title: `${a.title} — Arduino tutorial | Learn Arduino`, description: a.description, canonical, ogImage, body, jsonLd });
}

function indexPage(all) {
  const description = 'Free Arduino tutorials for beginners: blink an LED, read sensors, drive motors — every project explained step by step, and you can build each one in 3D in your browser.';
  const body = `<main id="main" class="hub">
  <header class="hub__hero">
    <p class="kicker">Free · Beginner friendly · In 3D</p>
    <h1>Arduino tutorials you can try right away</h1>
    <p class="lead">Every project explained step by step — how it works, the wiring, the code line by line — and every one of them runs in our free 3D lab, so you can try it before you buy a single part.</p>
    <a class="top__lab big" href="/">Open the 3D lab →</a>
  </header>
  ${Object.entries(KINDS).map(([k, v]) => {
    const list = all.filter((a) => a.kind === k);
    return list.length ? `<section class="more" id="${k}"><h2>${v}</h2><div class="cards">${list.map(card).join('')}</div></section>` : '';
  }).join('\n')}
</main>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Arduino tutorials', description, url: `${SITE}/learn/`,
    hasPart: all.map((a) => ({ '@type': 'TechArticle', headline: a.title, url: SITE + url(a.slug) })) };
  return page({ title: 'Free Arduino tutorials for beginners, in 3D | Learn Arduino', description, canonical: `${SITE}/learn/`, ogImage: all[0]?.og ? SITE + imgUrl(all[0].og) : undefined, body, jsonLd, type: 'website' });
}

export function build(out = path.join(ROOT, 'dist')) {
  const all = loadArticles();
  const affiliate = (() => { try { return JSON.parse(fs.readFileSync(path.join(CONTENT, 'affiliate.json'), 'utf8')); } catch { return {}; } })();
  const dir = path.join(out, 'learn');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const a of all) {
    fs.mkdirSync(path.join(dir, a.slug), { recursive: true });
    fs.writeFileSync(path.join(dir, a.slug, 'index.html'), articlePage(a, all, affiliate));
  }
  fs.writeFileSync(path.join(dir, 'index.html'), indexPage(all));
  fs.copyFileSync(path.join(ROOT, 'tools/learn/learn.css'), path.join(dir, 'learn.css'));
  fs.cpSync(path.join(CONTENT, 'img'), path.join(dir, 'img'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
  for (const p of new Set(Object.values(PARTS).map((x) => x.img).filter(Boolean))) fs.copyFileSync(path.join(ROOT, 'src/assets/components', `${p}.png`), path.join(dir, 'parts', `${p}.png`));
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'), path.join(dir, 'fonts/nunito.woff2'));
  // search engines: every page, and where the list is
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: `${SITE}/`, lastmod: today }, { loc: `${SITE}/learn/`, lastmod: today }, ...all.map((a) => ({ loc: SITE + url(a.slug), lastmod: a.updated ?? a.date ?? today })),
    { loc: `${SITE}/privacy.html` }, { loc: `${SITE}/terms.html` }];
  fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  return all;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = build(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`learn: ${all.length} tutorials → dist/learn (sitemap.xml, robots.txt)`);
}
