/**
 * site/doc-to-deck.js — turn a written document into a presentation
 * ---------------------------------------------------------------------------
 * Write a project the way you'd write a report (in the CMS editor, in
 * Google Docs, in Word) and the site finds its structure and maps it to
 * slides. No dependencies: the CMS-backed pages, the import script and the
 * browser demo all use this same file.
 *
 * Rules (every block remembers which rule produced it; see the outline page):
 *   Title       # Heading, or the document's first short line   → title slide
 *   Section     ## Heading, or a short line standing alone       → new slide
 *   Numbered    "2. Approach" / "2.1 Data" standing alone         → section / subsection
 *   Subsection  ### Heading                                       → titles the paragraph after it
 *   Label       a short ALL-CAPS line, or one ending in ":",
 *               just before a heading                            → small label above that heading
 *   Figure      "Revenue: 34%", "**34%** of trips…", "$1.2M raised" → big number with its caption
 *   Figures     a list where every item is a figure               → several big numbers
 *   Quote       > quoted text (last line "— Name" = source)       → pull quote
 *   Image       ![alt](src "caption")                             → figure
 *   List        - items / 1. items                                → list
 *   Break       ---                                               → force a new slide
 *   Overflow    more than maxBlocks blocks or maxWords words      → continues on a new slide
 *   Paragraph   anything else                                     → text (long ones split at sentences)
 */

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

/** Remove inline Markdown, keeping the words. */
export function plain(s) {
  return String(s)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 1. Plain text (pasted from Word or Docs) → Markdown headings, when it has none.
// ---------------------------------------------------------------------------
/**
 * A line that stands alone (blank lines around it), is short, and doesn't end
 * like a sentence is a heading. The first becomes the title. Numbered ones
 * ("2. Approach", "2.1 Data") take their level from the numbering. Short
 * ALL-CAPS lines are kept as labels.
 */
export function inferHeadings(text) {
  const src = String(text).replace(/\r\n?/g, '\n').replace(/^[\t ]*[•▪◦‣–]\s+/gm, '- ');
  const lines = src.split('\n');
  if (lines.some((l) => /^#{1,6}\s/.test(l))) return src; // already structured
  let titled = false;
  return lines.map((raw, i) => {
    const line = plain(raw.trim()); // a bold line in Word ("__Background__") is still a heading candidate
    if (!line) return '';
    const alone = (i === 0 || !lines[i - 1].trim()) && (i === lines.length - 1 || !lines[i + 1].trim());
    const short = words(line) <= 9 && line.length <= 72 && !/[.!?,;]$/.test(line);
    if (!alone || !short || /^[-*+>!]|^\d+[.)]\s+\S.*[.!?]$/.test(line)) return raw;
    const numbered = line.match(/^(\d+)((?:\.\d+)*)\.?\s+(\S.*)$/);
    if (numbered && !/\d/.test(numbered[3])) return `${numbered[2] ? '###' : '##'} ${numbered[3]}`;
    if (matchFigure(line)) return raw; // "Population: 100,000+" is a figure, not a heading
    const caps = line === line.toUpperCase() && /[A-Z]/.test(line);
    if (caps && words(line) <= 4 && titled) return raw; // a label; mapped below
    if (!titled) { titled = true; return `# ${line}`; }
    return `## ${line}`;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// 2. Markdown → blocks (headings, paragraphs, lists, quotes, images, rules).
// ---------------------------------------------------------------------------
export function parseBlocks(md) {
  const text = String(md).replace(/\r\n?/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, ''); // drop front matter
  const lines = text.split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  let quote = null;
  const flush = () => {
    if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; }
    if (list) { blocks.push(list); list = null; }
    if (quote) { blocks.push({ type: 'quote', lines: quote }); quote = null; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*$/))) { flush(); blocks.push({ type: 'h', level: m[1].length, text: plain(m[2]) }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ type: 'hr' }); continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)$/))) { flush(); blocks.push({ type: 'img', alt: m[1], src: m[2], caption: m[3] ?? '' }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (para.length || list) flush(); (quote ??= []).push(m[1]); continue; }
    if ((m = line.match(/^(?:[-*+]|(\d+)[.)])\s+(.*)$/))) {
      if (para.length || quote) flush();
      list ??= { type: 'list', ordered: !!m[1], items: [] };
      list.items.push(m[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ` ${line}`; continue; } // wrapped item
    if (quote) flush();
    if (list) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

// ---------------------------------------------------------------------------
// 3. Recognisers.
// ---------------------------------------------------------------------------
const UNITS = '%|×|x|bn|pts?|pp|ms|mins?|minutes?|hrs?|hours?|days?|weeks?|months?|years?|yrs?|mi|km|kg|lbs?|k|K|m|M|B|s|h';
const NUMBER = String.raw`[$€£¥]?[+−-]?\d[\d,.]*(?:\s?(?:${UNITS})(?![A-Za-z]))?\+?`; // a unit must end at a word boundary ("74 min", not "74 m" + "in")

/** "Label: 34%" | "34% of riders…" | "**$1.2M** raised" → { value, label } or null. */
export function matchFigure(text) {
  const t = String(text).trim();
  if (words(plain(t)) > 18) return null;
  let m = plain(t).match(new RegExp(`^([^:]{2,60}):\\s*(${NUMBER})\\s*(.*)$`));
  if (m && words(m[3]) <= 6) return { value: (m[2] + (m[3] ? ` ${m[3]}` : '')).trim(), label: m[1].trim() };
  m = t.match(new RegExp(`^(?:\\*\\*|__)?(${NUMBER})(?:\\*\\*|__)?\\s+(.{3,120})$`));
  if (m) {
    const value = m[1].trim();
    if (/^(1[89]|20)\d\d$/.test(value)) return null; // a year opens a sentence; it isn't a figure
    if (/\.$/.test(value)) return null;                // "1." or "2.1." is numbering, not a figure
    if (/^\d$/.test(value) && !/[%$×x]/.test(value)) return null; // "3 reasons why…" stays text
    return { value, label: plain(m[2]).replace(/^[-–—:]\s*/, '') };
  }
  return null;
}

/** A label: short, ALL CAPS or ending in a colon. */
export function isLabel(text) {
  const t = plain(text);
  return words(t) <= 4 && t.length <= 40 && ((t === t.toUpperCase() && /[A-Z]/.test(t)) || /:$/.test(t));
}

/** Split long text at sentence ends into chunks of at most `max` words. */
function chunk(text, max) {
  if (words(text) <= max) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && words(cur + s) > max) { out.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------------------
// 4. Blocks → slides.
// ---------------------------------------------------------------------------
/**
 * @param {string} source    Markdown, or plain text (headings inferred)
 * @param {object} [o]
 * @param {string} [o.title]       overrides the document's own title
 * @param {number} [o.maxWords=150]  words per slide before it continues
 * @param {number} [o.maxBlocks=4]   blocks per slide (besides the heading) before it continues
 * @param {number} [o.chunkWords=70] longest text block; longer paragraphs split at sentences
 * @returns {{ title: string, summary: string, slides: Array<{ blocks: Array }> }}
 *   Blocks use the presentation types: heading (with optional label), text
 *   (with optional heading), stat, quote, figure, list. Each carries `rule`.
 */
export function documentToProject(source, { title = '', maxWords = 150, maxBlocks = 4, chunkWords = 70 } = {}) {
  const blocks = parseBlocks(inferHeadings(source));
  const slides = [];
  let cur = null;
  let docTitle = title;
  let summary = '';
  let label = null;      // waiting for the next heading
  let subhead = null;    // waiting for the next text or list

  const count = (b) => words([b.text, b.value, b.label, b.heading, ...(b.items ?? [])].filter(Boolean).join(' '));
  const open = (heading, rule, extra = {}) => {
    cur = { heading, blocks: [], words: 0, body: 0 };
    slides.push(cur);
    if (heading) {
      const b = { type: 'heading', text: heading, rule, ...extra };
      if (label) { b.label = label; b.rule += ' · label above it'; label = null; }
      cur.blocks.push(b);
    }
  };
  const push = (b) => {
    if (!cur) open(docTitle || null, 'Document title → title slide');
    const w = count(b);
    if (cur.body >= maxBlocks || (cur.body > 0 && cur.words + w > maxWords)) {
      const h = cur.heading ? `${cur.heading.replace(/ \(continued\)$/, '')} (continued)` : null;
      open(h, 'Overflow → continued on a new slide');
    }
    if (subhead && (b.type === 'text' || b.type === 'list')) { b.heading = subhead; b.rule += ' · titled by the subheading above'; subhead = null; }
    cur.blocks.push(b);
    cur.words += w;
    cur.body += 1;
  };
  const flushSubhead = () => {
    if (subhead) { const s = subhead; subhead = null; push({ type: 'text', heading: s, text: '', rule: 'Subheading with nothing under it' }); }
  };

  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    switch (b.type) {
      case 'h':
        if (b.level === 1) {
          flushSubhead();
          if (!docTitle) docTitle = b.text;
          open(b.text, title && b.text !== title ? 'Heading 1 → title slide' : 'Title → title slide', { title: true });
        } else if (b.level === 2) {
          flushSubhead();
          open(b.text, 'Section heading → new slide');
        } else {
          flushSubhead();
          subhead = b.text;
        }
        break;
      case 'hr':
        flushSubhead();
        open(null, 'Break (---) → new slide');
        break;
      case 'img':
        flushSubhead();
        push({ type: 'figure', src: b.src, alt: b.alt, caption: b.caption || b.alt, rule: 'Image → figure' });
        break;
      case 'quote': {
        flushSubhead();
        const lines = [...b.lines];
        const by = lines.length > 1 && /^\s*(—|–|--|-)\s*\S/.test(lines[lines.length - 1]) ? plain(lines.pop()).replace(/^(—|–|--|-)\s*/, '') : '';
        push({ type: 'quote', text: plain(lines.join(' ')), by, rule: by ? 'Quote with source → pull quote' : 'Quote → pull quote' });
        break;
      }
      case 'list': {
        flushSubhead();
        const figs = b.items.map(matchFigure);
        if (b.items.length && figs.every(Boolean)) {
          figs.forEach((f) => push({ type: 'stat', value: f.value, label: f.label, rule: 'List of figures → big numbers' }));
        } else {
          push({ type: 'list', ordered: b.ordered, items: b.items.map(plain), rule: b.ordered ? 'Numbered list → list' : 'List → list' });
        }
        break;
      }
      case 'p': {
        if (next?.type === 'h' && next.level <= 2 && isLabel(b.text)) { label = plain(b.text).replace(/:$/, ''); break; }
        const fig = matchFigure(b.text);
        if (fig) { flushSubhead(); push({ type: 'stat', value: fig.value, label: fig.label, rule: 'Number with a caption → big number' }); break; }
        const text = plain(b.text);
        if (!summary) summary = text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, '')}…` : text;
        chunk(text, chunkWords).forEach((part, k) => push({ type: 'text', text: part, rule: k ? 'Long paragraph → split at a sentence' : 'Paragraph → text' }));
        break;
      }
      default: break;
    }
  });
  flushSubhead();

  // Drop empty slides (a break right after a heading, say).
  const kept = slides.filter((s) => s.blocks.length);
  return { title: docTitle || 'Untitled', summary, slides: kept.map((s) => ({ blocks: s.blocks })) };
}
