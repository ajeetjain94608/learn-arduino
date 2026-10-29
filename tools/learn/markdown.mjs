// The tutorials' own small Markdown: just what the articles use, nothing fetched, no dependencies.
//   # ## ###          headings (## and ### get ids and go in the table of contents)
//   paragraphs, - and 1. lists, | tables |, > callouts ("> **Tip:** …" becomes a Tip box)
//   ```cpp            code blocks (Arduino code is coloured)
//   ![alt](src "caption")   a figure, on its own line
//   [text](url) **bold** *italic* `code`
//   a line starting with <  raw HTML (diagrams)
//   ::: 3d blink "caption"   the project, live in 3D (a picture until it is tapped)

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- front matter ------------------------------------------------------------------------------------------------------
// key: value lines between two --- lines; [a, b] is a list; numbers stay numbers
export function frontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else v = v.replace(/^["']|["']$/g, '');
    data[kv[1]] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

// --- inline ------------------------------------------------------------------------------------------------------------
export function inline(text, { external = (href) => /^https?:\/\//.test(href) } = {}) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
    const ext = external(href.replace(/&amp;/g, '&'));
    return `<a href="${href}"${ext ? ' rel="noopener" target="_blank"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

// --- Arduino code colouring --------------------------------------------------------------------------------------------
const KEYWORDS = new Set(['void', 'int', 'long', 'float', 'double', 'char', 'bool', 'boolean', 'byte', 'unsigned', 'const', 'if', 'else', 'for', 'while', 'do', 'return', 'switch', 'case', 'break', 'default', 'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'String', 'static', '#include', '#define']);
export function highlight(code) {
  const out = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#\w+)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b(?=\s*\()|\b([A-Za-z_]\w*)\b/g;
  let last = 0, m;
  while ((m = re.exec(code))) {
    out.push(escapeHtml(code.slice(last, m.index)));
    const [all, comment, str, pre, num, fn, word] = m;
    const cls = comment ? 'c' : str ? 's' : pre ? 'k' : num ? 'n' : fn ? (KEYWORDS.has(fn) ? 'k' : 'f') : KEYWORDS.has(word) ? 'k' : null;
    out.push(cls ? `<span class="t-${cls}">${escapeHtml(all)}</span>` : escapeHtml(all));
    last = m.index + all.length;
  }
  out.push(escapeHtml(code.slice(last)));
  return out.join('');
}

// --- blocks ------------------------------------------------------------------------------------------------------------
// figure(src, alt, caption) lets the page builder add the picture's size (no layout jump while it loads)
export function render(md, { figure = defaultFigure, lab = defaultLab } = {}) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [], toc = [];
  const used = new Map();
  const idFor = (text) => { const base = slugify(text) || 'section', n = used.get(base) ?? 0; used.set(base, n + 1); return n ? `${base}-${n + 1}` : base; };
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { // code
      flush();
      const lang = line.slice(3).trim(), body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      const code = body.join('\n');
      html.push(`<pre class="code" data-lang="${escapeHtml(lang || 'text')}"><code>${/^(cpp|c|arduino|ino)$/.test(lang) ? highlight(code) : escapeHtml(code)}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length, text = inline(h[2]);
      if (level === 1) html.push(`<h1>${text}</h1>`);
      else { const id = idFor(h[2]); toc.push({ level, id, text: h[2].replace(/[*`]/g, '') }); html.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${level}>`); }
      i++; continue;
    }
    const live = line.match(/^:::\s*3d\s+(\S+)(?:\s+"([^"]*)")?\s*$/);
    if (live) { flush(); html.push(lab(live[1], live[2] ?? '')); i++; continue; }
    const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (img) { flush(); html.push(figure(img[2], img[1], img[3] ?? '')); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) { // list
      flush();
      const ordered = /^\s*\d+\./.test(line), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        for (i++; i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) item += ' ' + lines[i].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>/.test(line)) { // callout
      flush();
      const body = [];
      for (; i < lines.length && /^>/.test(lines[i]); i++) body.push(lines[i].replace(/^>\s?/, ''));
      const text = body.join(' ');
      const kind = text.match(/^\*\*(Tip|Warning|Note|Try it|Did you know\?|Safety):?\*\*:?/i);
      const cls = kind ? slugify(kind[1]) : 'note';
      html.push(`<aside class="callout callout--${cls}">${inline(text)}</aside>`);
      continue;
    }
    if (/^\|/.test(line)) { // table
      flush();
      const rows = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i].replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim()));
      const [head, sep, ...rest] = rows;
      const body = sep && sep.every((c) => /^:?-+:?$/.test(c)) ? rest : [sep, ...rest].filter(Boolean);
      html.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^</.test(line)) { // raw HTML block, up to a blank line
      flush();
      const block = [];
      for (; i < lines.length && lines[i].trim() !== ''; i++) block.push(lines[i]);
      html.push(block.join('\n'));
      continue;
    }
    if (line.trim() === '') { flush(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return { html: html.join('\n'), toc };
}

function defaultLab(project, caption) {
  return `<figure class="lab3d"><div class="lab3d__frame" data-src="/?embed#/projects/${encodeURIComponent(project)}"><button type="button" class="lab3d__play">Play in 3D</button></div>${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}</figure>`;
}

function defaultFigure(src, alt, caption) {
  return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}</figure>`;
}

// about how long an article takes to read (words ÷ 200, at least 1 minute)
export const readingMinutes = (md) => Math.max(1, Math.round(md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length / 200));
