/**
 * stijl/compose.js — sections that assemble themselves from De Stijl rules
 * ---------------------------------------------------------------------------
 * Any section (the Projects index, a presentation slide, a gallery room, the
 * blog index) is a list of items. composeSection() turns that list into a
 * Mondrian composition:
 *
 *   • Guillotine splits only: every cut runs edge to edge of its field.
 *   • Space follows weight: a split divides the items where their weights
 *     balance, and the cut lands at that proportion (± a little jitter, so
 *     cuts are never centred). Reading order is kept: items are never shuffled.
 *   • Cut direction follows the field: wide fields split vertically, tall
 *     ones horizontally, square ones either way.
 *   • Accents: small empty fields are interleaved between items and take the
 *     primary colours (sometimes ink), under the 37.5% colour cap. Items can
 *     ask for a colour (tone) or let the composer decide.
 *   • Line weight falls with depth: the first cuts are the heaviest.
 *
 * Every cut keeps its depth and order, so the page can grow the composition
 * the way it was "painted": first lines first, then fields fill, then content.
 *
 * Each section is composed twice, wide (desktop) and tall (phones). Items are
 * rendered once and pick their layout with a container query, so content is
 * never duplicated.
 */
import { STIJL, seededRandom, escapeHtml } from '../illusion/config.js';

const LINE_PX = [12, 9, 7, 6, 5, 4];          // OPTION: [16, 12, 8, 6, 5, 4] for heavier, more graphic lines
const HUES = { red: STIJL.red, blue: STIJL.blue, yellow: STIJL.yellow, ink: STIJL.ink, paper: STIJL.paper };
const LIGHT_TEXT = new Set(['red', 'blue', 'ink']);

/**
 * @param {object} o
 * @param {number} o.seed
 * @param {Array<{ id: string, weight?: number, tone?: 'auto'|'paper'|'red'|'blue'|'yellow' }>} o.items
 * @param {number} [o.aspect=1.6]     width / height of the section
 * @param {number} [o.cap=0.375]      maximum share of area in colour
 * @param {number} [o.accents=0.5]    accent fields per item (0 = none)
 * @param {number} [o.autoColour=0.3] chance an 'auto' item takes a colour
 */
export function composeSection({ seed, items, aspect = 1.6, cap = 0.375, accents = 0.5, autoColour = 0.3, lineScale = 1 }) {
  const rand = seededRandom(seed);
  const W = 1000 * aspect;
  const H = 1000;

  // Interleave accent fields between items (never first, so the section opens on content).
  const list = items.map((it) => ({ ...it, weight: Math.max(0.05, it.weight ?? 1), kind: 'item' }));
  const nAccents = accents > 0 ? Math.max(1, Math.round(items.length * accents)) : 0;
  for (let k = 0; k < nAccents; k++) {
    const at = 1 + Math.floor(rand() * list.length);
    list.splice(at, 0, { id: `accent-${k}`, kind: 'accent', weight: 0.14 + rand() * 0.2 });
  }

  const leaves = [];
  const cuts = [];
  const sum = (g) => g.reduce((a, b) => a + b.weight, 0);

  function place(r, group, depth) {
    if (group.length === 1) { leaves.push({ ...r, entry: group[0], depth }); return; }
    // Split where the weights balance, keeping order.
    const total = sum(group);
    let acc = 0, k = 1, best = Infinity;
    for (let i = 1; i < group.length; i++) {
      acc += group[i - 1].weight;
      const d = Math.abs(acc - total / 2);
      if (d < best) { best = d; k = i; }
    }
    const a = group.slice(0, k);
    const b = group.slice(k);
    const t = Math.min(0.82, Math.max(0.18, sum(a) / total + (rand() - 0.5) * 0.08));
    const ar = r.w / r.h;
    const vertical = ar > 1.2 ? true : ar < 0.83 ? false : rand() < 0.5;
    if (vertical) {
      const cx = r.x + r.w * t;
      cuts.push({ axis: 'v', x: cx, y: r.y, len: r.h, depth });
      place({ x: r.x, y: r.y, w: cx - r.x, h: r.h }, a, depth + 1);
      place({ x: cx, y: r.y, w: r.x + r.w - cx, h: r.h }, b, depth + 1);
    } else {
      const cy = r.y + r.h * t;
      cuts.push({ axis: 'h', x: r.x, y: cy, len: r.w, depth });
      place({ x: r.x, y: r.y, w: r.w, h: cy - r.y }, a, depth + 1);
      place({ x: r.x, y: cy, w: r.w, h: r.y + r.h - cy }, b, depth + 1);
    }
  }
  place({ x: 0, y: 0, w: W, h: H }, list, 0);

  // Colour: requested tones first, then accents (largest first), then 'auto' items, under the cap.
  const area = (l) => (l.w * l.h) / (W * H);
  let covered = 0;
  let hue = Math.floor(rand() * 3);
  const primaries = ['red', 'blue', 'yellow'];
  const colour = (l, name) => { l.tone = name; if (name !== 'paper') covered += area(l); };
  leaves.forEach((l) => { l.tone = 'paper'; });
  leaves.filter((l) => l.entry.kind === 'item' && l.entry.tone && l.entry.tone !== 'auto')
    .forEach((l) => colour(l, l.entry.tone));
  leaves.filter((l) => l.entry.kind === 'accent').sort((p, q) => area(q) - area(p)).forEach((l) => {
    const small = area(l) < 0.02;
    const name = small && rand() < 0.3 ? 'ink' : primaries[hue++ % 3];
    if (covered + area(l) <= cap) colour(l, name);
  });
  leaves.filter((l) => l.entry.kind === 'item' && (!l.entry.tone || l.entry.tone === 'auto')).forEach((l) => {
    if (rand() < autoColour && covered + area(l) <= cap) colour(l, primaries[hue++ % 3]);
  });

  // Assembly order: breadth-first by depth, left-to-right/top-to-bottom within a depth.
  const byDepth = [...cuts].sort((p, q) => p.depth - q.depth || p.y - q.y || p.x - q.x);
  byDepth.forEach((c, i) => { c.step = i; c.px = Math.max(1, +(LINE_PX[Math.min(c.depth, LINE_PX.length - 1)] * lineScale).toFixed(2)); });
  const lastStep = byDepth.length;
  leaves.sort((p, q) => p.depth - q.depth || p.y - q.y || p.x - q.x).forEach((l, i) => { l.step = lastStep + i * 0.6; });

  const pct = (v, of) => +((v / of) * 100).toFixed(3);
  return {
    aspect,
    coverage: covered,
    leaves: leaves.map((l) => ({
      id: l.entry.id, kind: l.entry.kind, tone: l.tone, depth: l.depth, step: l.step,
      x: pct(l.x, W), y: pct(l.y, H), w: pct(l.w, W), h: pct(l.h, H),
    })),
    cuts: byDepth.map((c) => ({
      axis: c.axis, depth: c.depth, step: c.step, px: c.px,
      x: pct(c.x, W), y: pct(c.y, H), len: pct(c.len, c.axis === 'v' ? H : W),
    })),
  };
}

/**
 * CSS custom properties that place one item in one layout.
 * prefix 'w' (wide) or 't' (tall).
 */
function placeVars(leaf, prefix) {
  return `--${prefix}x:${leaf.x}%;--${prefix}y:${leaf.y}%;--${prefix}w:${leaf.w}%;--${prefix}h:${leaf.h}%;` +
    `--${prefix}fill:${HUES[leaf.tone]};--${prefix}ink:${LIGHT_TEXT.has(leaf.tone) ? STIJL.paper : STIJL.ink};--${prefix}step:${leaf.step};`;
}

/** Decorative layer (lines and accent fields) for one layout. */
function decoHTML(layout, which) {
  const accents = layout.leaves.filter((l) => l.kind === 'accent').map((l) =>
    `<span class="stijl__accent" style="left:${l.x}%;top:${l.y}%;width:${l.w}%;height:${l.h}%;--fill:${HUES[l.tone]};--step:${l.step}"></span>`).join('');
  const lines = layout.cuts.map((c) => (c.axis === 'v'
    ? `<span class="stijl__line stijl__line--v" style="left:calc(${c.x}% - ${c.px / 2}px);top:${c.y}%;height:${c.len}%;width:${c.px}px;--step:${c.step}"></span>`
    : `<span class="stijl__line stijl__line--h" style="top:calc(${c.y}% - ${c.px / 2}px);left:${c.x}%;width:${c.len}%;height:${c.px}px;--step:${c.step}"></span>`)).join('');
  return `<div class="stijl__deco stijl__deco--${which}" aria-hidden="true">${accents}${lines}</div>`;
}

/** Default card: kicker, title (a stretched link), summary, meta. */
export function cardHTML(item) {
  const title = item.href
    ? `<a class="stijl__title-link" href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title ?? '');
  return `
    ${item.kicker ? `<p class="stijl__kicker">${escapeHtml(item.kicker)}</p>` : ''}
    <h3 class="stijl__title">${title}</h3>
    ${item.summary ? `<p class="stijl__summary">${escapeHtml(item.summary)}</p>` : ''}
    ${item.meta ? `<p class="stijl__meta">${escapeHtml(item.meta)}</p>` : ''}`;
}

/**
 * Render a whole section.
 * @param {object} o
 * @param {Array} o.items              each { id, weight?, tone?, html? | title/summary/href/kicker/meta }
 * @param {number} o.seed
 * @param {number} [o.wide=1.6]        aspect on wide screens
 * @param {number} [o.tall=0.5]        aspect on phones (use 0.3 for long lists) (below the breakpoint in stijl.css)
 * @param {string} [o.label]           accessible name of the section
 * @param {string} [o.tag='section']
 * @param {object} [o.compose]         extra options for composeSection (cap, accents, autoColour, lineScale)
 * @param {boolean} [o.single]         one composition for every width (for fields of fixed shape,
 *                                     such as sections nested inside the map)
 */
export function renderSection({ items, seed, wide = 1.6, tall = 0.5, label = '', tag = 'section', compose = {}, single = false }) {
  const W = composeSection({ seed, items, aspect: wide, ...compose });
  const T = single ? W : composeSection({ seed: seed + 101, items, aspect: tall, ...compose });
  if (single) tall = wide;
  const wBy = Object.fromEntries(W.leaves.map((l) => [l.id, l]));
  const tBy = Object.fromEntries(T.leaves.map((l) => [l.id, l]));
  const cells = items.map((it) =>
    `<article class="stijl__item" data-id="${escapeHtml(it.id)}" style="${placeVars(wBy[it.id], 'w')}${placeVars(tBy[it.id], 't')}">${it.html ?? cardHTML(it)}</article>`).join('');
  return `<div class="stijl-wrap"><${tag} class="stijl" style="--ar-wide:${wide};--ar-tall:${tall}" data-seed="${seed}"${single ? ' data-single' : ''}${label ? ` aria-label="${escapeHtml(label)}"` : ''}>
    ${decoHTML(W, 'wide')}${single ? '' : decoHTML(T, 'tall')}${cells}
  </${tag}></div>`;
}

/**
 * Spring easing as a CSS linear() curve: a damped oscillator
 * x(t) = 1 − e^(−ζωt)(cos ω_d t + (ζω/ω_d) sin ω_d t), sampled. Used so lines
 * overshoot a touch and settle, like something placed by hand.
 */
export function springEasing(zeta = 0.55, samples = 32) {
  const omega = 9; // rad per unit time; with ζ = 0.55 it settles within t = 1
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    pts.push(+x.toFixed(4));
  }
  pts[pts.length - 1] = 1;
  return `linear(${pts.join(', ')})`;
}
