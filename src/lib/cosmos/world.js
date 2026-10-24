// DESCRIPTION: Composes portfolio content into deterministic navigable Mondrian world geometry.
// INPUTS: Seed, CMS modules, project blocks and résumé stations.
// OUTPUTS: World model, server-rendered map HTML and its complete route list.
// DEPENDENCIES: Mondrian composer, editorial renderer and escaped content helpers.
/**
 * cosmos/world.js — the map: a Mondrian world larger than any screen
 * ---------------------------------------------------------------------------
 * Two levels of composition, like kingdoms and provinces on a map:
 *   1. The world (12000 × 7600 units) is split into regions with heavy lines.
 *   2. Each region is split again with lighter lines. Module regions keep
 *      paper fields for their content; the rest are coloured under the cap.
 *
 * worldModel() is pure data and renderWorldHTML() returns a string, so
 * Astro can render the whole map on the server (indexable, works without
 * JavaScript as a scrollable page) and the client can rebuild it when the
 * seed changes.
 *
 * Level of detail is pure CSS: each text element carries its world font
 * size (--fs); the camera sets the scale (--cos-s); opacity fades in when
 * the on-screen size passes ~8px and out past ~900px. No per-frame JS.
 *
 * Everything on the site lives here. Items come in kinds:
 *   project  its field holds its slides as a nested composition (plus a
 *            "Read as report" field); each slide holds its own blocks. The
 *            camera flies into a slide to present it; ← → fly slide to slide.
 *   read     a post or a page: up close the field becomes a reading column
 *   photo    a photograph under a painted cover that shatters on arrival
 *   cards    a nested composition of cards (resumé sections, API endpoints)
 * Nested fields carry exact world rectangles (data-fly), computed from the
 * same composition the page renders, so the camera can fly into them.
 */
import { composeBSP, colourLeaves, insetRect } from './mondrian.js';
import { escapeHtml, seededRandom, STIJL } from '../illusion/config.js';
import { composeSection, renderSection, cardHTML } from '../stijl/compose.js';
import { slideItems } from '../stijl/presentation.js';
import { renderEditorialSpread, layoutEditorialPages } from '../stijl/editorial.js';

/** Text tone per field colour: paper text on red and blue, ink on yellow and paper. */
const FIELD_LIGHT_TEXT = new Set([STIJL.red, STIJL.blue]);

export const WORLD = { w: 12000, h: 7600 };
const TOP_LINES = [72, 56, 44, 36];
const INNER_LINES = [24, 18, 13, 10, 8, 6];

const round = (n) => Math.round(n * 10) / 10;

/**
 * @param {number} seed
 * @param {Array} modules  [{ id, title, summary, items: [{ id, title, body }] }]
 */
export function worldModel(seed, modules) {
  // The world needs a region for every module plus the singularity and at least one wild one.
  // Most seeds give that at once; for the rare one that doesn't, split a little finer.
  let top;
  for (let attempt = 0; attempt < 6; attempt++) {
    top = composeBSP({
      seed: seed + attempt * 104729,
      rect: { x: 0, y: 0, w: WORLD.w, h: WORLD.h },
      depth: 3 + (attempt > 2 ? 1 : 0),
      minSize: 1500,
      stopChance: attempt ? 0.03 : 0.1,
      line: (d) => TOP_LINES[Math.min(d, TOP_LINES.length - 1)],
      frame: { l: 110, t: 110, r: 110, b: 110 },
    });
    if (top.length >= modules.length + 2) break;
  }


  // Largest regions go to the modules, in order of prominence.
  const bySize = top.map((l, i) => ({ i, a: l.w * l.h })).sort((a, b) => b.a - a.a);
  const assignment = new Map(bySize.slice(0, modules.length).map((s, k) => [s.i, modules[k]]));
  // The smallest remaining region hosts the singularity.
  const wild = bySize.slice(modules.length);
  const singularityIndex = wild.length ? wild[wild.length - 1].i : null;

  const regions = top.map((leaf, i) => {
    const rect = insetRect(leaf);
    const module = assignment.get(i) ?? null;
    const kind = module ? 'module' : i === singularityIndex ? 'singularity' : 'wild';
    const rseed = (seed * 31 + i * 977) >>> 0;

    if (kind === 'singularity') {
      return { kind, id: 'singularity', rect, leaves: [] };
    }

    // A module needs one field for its heading plus one per item. If a split
    // stops short (small region, early stops), recompose finer until it fits.
    const needed = module ? 1 + module.items.length : 0;
    let inner;
    for (let attempt = 0; attempt < 4; attempt++) {
      inner = composeBSP({
        seed: rseed + attempt * 7919,
        rect: { x: 0, y: 0, w: rect.w, h: rect.h },
        depth: (kind === 'module' ? (module.items.length > 3 ? 5 : 4) : 5) + attempt, // busier regions subdivide further
        minSize: Math.max(160, Math.min(rect.w, rect.h) * 0.12 * 0.8 ** attempt),
        stopChance: attempt ? 0.05 : undefined,
        line: (d) => INNER_LINES[Math.min(d, INNER_LINES.length - 1)],
        frame: { l: 0, t: 0, r: 0, b: 0 },
        cross: kind === 'module',
      });
      if (inner.length >= needed + 1) break; // +1 so at least one field is left for colour
    }

    // Content goes in the roomiest fields. The module heading stays on paper;
    // item fields ignore colour, so red, yellow and blue fields are containers too.
    const reserve = new Set();
    const roles = new Map();
    if (module) {
      // Well-shaped fields first (aspect under 3:1), then the rest by size, so
      // every item always finds a field even in an awkward split.
      const roomy = inner
        .map((l, k) => ({ k, a: l.w * l.h, ok: l.w / l.h < 3 && l.h / l.w < 3 }))
        .sort((a, b) => (b.ok - a.ok) || (b.a - a.a));
      roomy.slice(0, 1 + module.items.length).forEach((c, n) => {
        if (n === 0) reserve.add(c.k);
        roles.set(c.k, n === 0 ? { role: 'content' } : { role: 'item', item: module.items[n - 1] });
      });
    }
    const coloured = colourLeaves(inner, { seed: rseed, reserve });
    const rand = seededRandom(rseed ^ 0x51ed);

    const leaves = coloured.map((l, k) => {
      const r = insetRect(l);
      const tall = l.fill !== STIJL.paper && roles.get(k)?.role !== 'item';
      return {
        x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h),
        fill: l.fill,
        // Height a coloured field rises to in flight (world units).
        rise: tall ? Math.round(Math.sqrt(r.w * r.h) * (0.25 + rand() * 0.5)) : 0,
        ...(roles.get(k) ?? {}),
      };
    });
    return { kind, id: module?.id ?? `wild-${i}`, module, rect, leaves };
  });

  return { size: WORLD, seed, regions };
}

/** Text block with LOD: world font size baked in as --fs. */
function lod(tag, text, fs, cls = '') {
  return `<${tag} class="cos-lod ${cls}" style="--fs:${round(fs)};font-size:${round(fs)}px">${text}</${tag}>`;
}

function flyAttr(rect, ox = 0, oy = 0) {
  return `data-fly="${round(rect.x + ox)},${round(rect.y + oy)},${round(rect.w)},${round(rect.h)}"`;
}

/** Where links point: real paths on the site ("/"), fragments in single-file demos ("#/"). */
const linkTo = (base, route) => `${base}${route}`;

/** The inner box of a field (a small margin inside its lines). */
function nestBox(rect) {
  const pad = Math.min(rect.w, rect.h) * 0.035;
  return { x: rect.x + pad, y: rect.y + pad, w: rect.w - 2 * pad, h: rect.h - 2 * pad, pad };
}
const boxStyle = (box) => `left:${round(box.pad)}px;top:${round(box.pad)}px;width:${round(box.w)}px;height:${round(box.h)}px`;
const lineScaleFor = (w) => Math.min(1, Math.max(0.12, w / 1600));

/**
 * A composition nested in a box of the world. Returns the world rectangle
 * of every entry (for flying to it) and a renderer for its HTML.
 */
function nestedSection({ entries, seed, box, accents = 0.35, autoColour = 0.3 }) {
  const aspect = box.w / box.h;
  const compose = { accents, autoColour, lineScale: lineScaleFor(box.w) };
  const { leaves } = composeSection({ seed, items: entries, aspect, ...compose });
  const rects = Object.fromEntries(leaves.map((l) => [l.id, {
    x: box.x + (l.x / 100) * box.w, y: box.y + (l.y / 100) * box.h, w: (l.w / 100) * box.w, h: (l.h / 100) * box.h,
  }]));
  return { rects, html: (items) => renderSection({ items, seed, wide: aspect, single: true, tag: 'div', compose }) };
}

/** A project: its slides (and its report) as a nested composition. */
function projectInner(item, rect, route, base, seed) {
  const box = nestBox(rect);
  const slides = item.slides ?? [];
  const entries = slides.map((_, i) => ({ id: `s${i + 1}`, weight: i === 0 ? 1.7 : 1, tone: 'paper' }));
  // A presentation keeps its report as a small field after the slides; a report leads with it, large.
  if (item.report) {
    if (item.format === 'report') entries.unshift({ id: 'report', weight: 2.4, tone: 'yellow' });
    else entries.push({ id: 'report', weight: 0.75, tone: 'yellow' });
  }
  const pages = layoutEditorialPages(entries.length, box);
  const items = entries.map((e, pageIndex) => {
    const r = pages[pageIndex];
    const i = e.id === 'report' ? -1 : Number(e.id.slice(1)) - 1;
    if (e.id === 'report') {
      const rr = `${route}/report`;
      const inner = nestBox({ ...r, x: 0, y: 0 });
      return `<div class="park-project-page" style="left:${round(r.x-box.x)}px;top:${round(r.y-box.y)}px;width:${round(r.w)}px;height:${round(r.h)}px"><div class="cos-nested cos-kind-read" data-route="${rr}" data-read ${flyAttr(r)}>
        <a class="cos-nest-label" href="${linkTo(base, rr)}" data-route="${rr}">Read as report</a>
        <article class="cos-read" style="${boxStyle(inner)}">${item.report}</article></div></div>`;
    }
    const sr = `${route}/${i + 1}`;
    const heading = slides[i].blocks.find((b) => b.type === 'heading')?.text ?? `Slide ${i + 1}`;
    const slide = renderEditorialSpread(slides[i], { index: i, total: slides.length, title: item.title });
    return `<div class="park-project-page" style="left:${round(r.x-box.x)}px;top:${round(r.y-box.y)}px;width:${round(r.w)}px;height:${round(r.h)}px"><div class="cos-slide" data-route="${sr}" data-seq="${route}" data-i="${i}" ${flyAttr(r)}><a class="cos-sr" href="${linkTo(base, sr)}" data-route="${sr}">Section ${i + 1}: ${escapeHtml(heading)}</a>${slide}</div></div>`;
  });
  return `<div class="cos-nest park-project-pages" style="${boxStyle(box)}">${items.join('')}</div>`;
}

/** Cards (resumé entries, API endpoints) as a nested composition. */
function cardsInner(item, rect, seed) {
  const box = nestBox(rect);
  const entries = (item.cards ?? []).map((c, k) => ({ id: `c${k}`, weight: c.weight ?? 1, tone: c.tone ?? 'auto' }));
  const nest = nestedSection({ entries, seed, box, accents: 0.3, autoColour: 0.3 });
  return `<div class="cos-nest" style="${boxStyle(box)}">${nest.html(item.cards.map((c, k) => ({ ...entries[k], html: cardHTML(c) })))}</div>`;
}

/** Every résumé entry is a numbered, deep-linkable station in its own field. */
function journeyInner(item, rect, route, base, seed) {
  const box = nestBox(rect);
  if (!item.stations?.length) return '';
  const entries = item.stations.map((s) => ({ id: s.id, weight: 1, tone: s.type === 'personal' ? 'yellow' : 'paper' }));
  const nest = nestedSection({ entries, seed, box, accents: 0.18, autoColour: 0 });
  return `<div class="cos-nest" style="${boxStyle(box)}">${nest.html(item.stations.map((s, i) => {
    const stationRoute = `${route}/${s.id}`;
    return { ...entries[i], html: `<article class="cos-station" data-route="${stationRoute}" data-seq="resume-stations" data-i="${s.index}" ${flyAttr(nest.rects[s.id])} data-station-type="${s.type}"><a class="park-station__marker" href="${linkTo(base, stationRoute)}" data-route="${stationRoute}" aria-label="Station ${s.index + 1}: ${escapeHtml(s.title)}">${String(s.index + 1).padStart(2, '0')}</a><div class="park-station__body" data-park-scroll tabindex="0"><p class="park-station__kicker">${escapeHtml(s.type)} · ${escapeHtml(s.dates || item.title)}</p><h3>${escapeHtml(s.title)}</h3><p class="park-station__org">${escapeHtml(s.org)}</p><p>${escapeHtml(s.note)}</p></div></article>` };
  }))}</div>`;
}

/** Mondrian shards over a photo (in % of the field), each with its own fall. */
function paintCover(rect, rand, delay) {
  const pieces = [{ x: 0, y: 0, w: 100, h: 100 }];
  const n = 5 + Math.floor(rand() * 4);
  while (pieces.length < n) {
    pieces.sort((a, b) => b.w * b.h - a.w * a.h);
    const p = pieces.shift();
    const t = 0.3 + rand() * 0.4;
    if (p.w * rect.w >= p.h * rect.h) pieces.push({ ...p, w: p.w * t }, { ...p, x: p.x + p.w * t, w: p.w * (1 - t) });
    else pieces.push({ ...p, h: p.h * t }, { ...p, y: p.y + p.h * t, h: p.h * (1 - t) });
  }
  const hues = [STIJL.red, STIJL.blue, STIJL.yellow, STIJL.paper, STIJL.paper];
  const fill = hues[Math.floor(rand() * hues.length)];
  const size = Math.max(rect.w, rect.h);
  return pieces.map((p) => {
    const cx = p.x + p.w / 2 - 50, cy = p.y + p.h / 2 - 50;
    const vars = [
      `--c:${fill}`, `--d:${(delay + rand() * 0.35).toFixed(2)}s`,
      `--dx:${round(cx * size * 0.012)}px`, `--dy:${round((cy * 0.6 + 40 + rand() * 30) * size * 0.012)}px`, // outward, and down: gravity
      `--dz:${round(-(0.9 + rand() * 0.9) * size)}px`,                                                      // away from the viewer
      `--rx:${Math.round((rand() - 0.5) * 300)}deg`, `--ry:${Math.round((rand() - 0.5) * 300)}deg`, `--rz:${Math.round((rand() - 0.5) * 120)}deg`,
    ].join(';');
    return `<span class="cos-shard" style="left:${round(p.x)}%;top:${round(p.y)}%;width:${round(p.w) + 0.4}%;height:${round(p.h) + 0.4}%;${vars}"></span>`;
  }).join('');
}

/**
 * The whole map as an HTML string (goes inside .cos-plane).
 * @param {object} model   from worldModel()
 * @param {{ base?: string }} [o]   "/" for real paths (the site), "#/" for single-file demos
 */
export function renderWorldHTML(model, { base = '/' } = {}) {
  const rand = seededRandom(model.seed ^ 0x6a11);
  return model.regions.map((region) => {
    const R = region.rect;
    const pos = `left:${round(R.x)}px;top:${round(R.y)}px;width:${round(R.w)}px;height:${round(R.h)}px`;

    if (region.kind === 'singularity') {
      const fs = Math.min(R.w, R.h) * 0.07;
      return `<a class="cos-region cos-singularity" href="${linkTo(base, 'singularity')}" data-route="singularity" ${flyAttr(R)} style="${pos}" aria-label="Enter the black hole">
        <span class="cos-singularity__hole" aria-hidden="true"></span>
        ${lod('span', 'Singularity', fs, 'cos-singularity__label')}
      </a>`;
    }

    const route = region.module ? region.module.id : null;
    const cells = region.leaves.map((l) => {
      const style = `left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;background:${l.fill}`;
      if (l.role === 'content') {
        const m = region.module;
        // Kingdom names scale with the whole region, so they read from the overview.
        const fs = Math.min(R.w * 0.075, l.w * 0.16, l.h * 0.3);
        return `<a class="cos-cell cos-cell--content" href="${linkTo(base, m.id)}" data-route="${m.id}" ${flyAttr(R)} style="${style};padding:${round(fs * 0.4)}px">
          ${lod('h2', escapeHtml(m.title), fs, 'cos-h2')}
          ${lod('p', escapeHtml(m.summary), fs * 0.2, 'cos-p')}
        </a>`;
      }
      const tone = FIELD_LIGHT_TEXT.has(l.fill) ? 'light' : 'dark';
      if (l.role === 'item') {
        const item = l.item;
        const kind = item.kind ?? 'plain';
        // Province names stay under 35% of the kingdom's, so they appear only as you approach.
        const moduleFs = Math.min(R.w * 0.075, ...region.leaves.filter((c) => c.role === 'content').map((c) => Math.min(l.w * 10, c.w * 0.16, c.h * 0.3)));
        const fs = Math.min(l.w * 0.08, l.h * 0.16, moduleFs * 0.35);
        const itemRoute = `${route}/${item.id}`;
        const rect = { x: R.x + l.x, y: R.y + l.y, w: l.w, h: l.h };
        const seq = ` data-seq="${route}" data-i="${region.module.items.indexOf(item)}"`;
        const shot = item.shot ? ` data-shot="${escapeHtml(item.shot)}"` : '';
        const seed = (model.seed * 7 + region.module.items.indexOf(item) * 131 + route.length * 17) >>> 0;
        const title = `<div class="cos-cell__body" style="--bw:${round(Math.min(l.w, l.h) * 0.92)}">
            <a class="cos-item-link" href="${linkTo(base, itemRoute)}" data-route="${itemRoute}">${lod('h3', escapeHtml(item.title), fs, 'cos-h3')}</a>
            ${item.body ? lod('p', escapeHtml(item.body), fs * 0.24, 'cos-p') : ''}
          </div>`;
        let inner = '';
        let extra = '';
        if (kind === 'project') inner = projectInner(item, rect, itemRoute, base, seed);
        else if (kind === 'cards') inner = cardsInner(item, rect, seed);
        else if (kind === 'journey') inner = journeyInner(item, rect, itemRoute, base, seed);
        else if (kind === 'read') { extra = ' data-read'; inner = `<article class="cos-read" style="${boxStyle(nestBox({ ...rect, x: 0, y: 0 }))}">${item.html ?? ''}</article>`; }
        else if (kind === 'photo') {
          const regionCentre = Math.hypot((l.x + l.w / 2) / R.w - 0.5, (l.y + l.h / 2) / R.h - 0.5);
          extra = ` data-photo="${escapeHtml(item.src)}"`;
          return `<div class="cos-cell cos-cell--item cos-kind-photo" data-route="${itemRoute}"${seq}${extra} ${flyAttr(rect)} style="${style}">
            <img class="cos-photo" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt ?? '')}" loading="lazy" decoding="async" draggable="false">
            <a class="cos-item-link cos-sr" href="${linkTo(base, itemRoute)}" data-route="${itemRoute}">${escapeHtml(item.alt ?? item.title)}</a>
            <span class="cos-paint" aria-hidden="true">${paintCover(rect, rand, regionCentre * 0.9)}</span>
          </div>`;
        }
        const nested = inner ? ` style="${style};--nw:${round(Math.max(nestBox(rect).w, nestBox(rect).h))}"` : ` style="${style};padding:${round(fs * 0.4)}px"`;
        const format = kind === 'project' ? ` data-format="${item.format ?? 'deck'}"` : '';
        return `<div class="cos-cell cos-cell--item cos-kind-${kind}" data-route="${itemRoute}"${seq}${extra}${format} data-tone="${tone}"${shot} ${flyAttr(rect)}${nested}>
          ${title}${inner}
        </div>`;
      }
      return `<div class="cos-cell" data-tone="${tone}" ${flyAttr(l, R.x, R.y)} style="${style};--h:${l.rise}"></div>`;
    }).join('');

    const routeAttr = route ? ` data-route-region="${route}"` : '';
    return `<div class="cos-region cos-region--${region.kind}"${routeAttr} ${flyAttr(R)} style="${pos}">${cells}</div>`;
  }).join('');
}

/**
 * Every place on the site, for static pages: { route, title, description }.
 * '' is the overview. Routes match data-route in the map.
 */
export function worldRoutes(modules, siteTitle = 'Hoc omnia nihil est') {
  const out = [{ route: '', title: siteTitle, description: '' }];
  for (const m of modules) {
    out.push({ route: m.id, title: `${m.title} — ${siteTitle}`, description: m.summary ?? '' });
    for (const item of m.items) {
      const r = `${m.id}/${item.id}`;
      out.push({ route: r, title: `${item.title} — ${siteTitle}`, description: item.body ?? '' });
      (item.slides ?? []).forEach((s, i) => {
        const h = s.blocks.find((b) => b.type === 'heading')?.text ?? `Slide ${i + 1}`;
        out.push({ route: `${r}/${i + 1}`, title: `${item.title}: ${h} — ${siteTitle}`, description: item.body ?? '' });
      });
      if (item.report) out.push({ route: `${r}/report`, title: `${item.title} (report) — ${siteTitle}`, description: item.body ?? '' });
      for (const station of item.stations ?? []) out.push({ route: `${r}/${station.id}`, title: `${station.title} — ${siteTitle}`, description: station.note ?? '' });
    }
  }
  out.push({ route: 'singularity', title: `Singularity — ${siteTitle}`, description: '' });
  return out;
}

/** Every leaf in world coordinates (for painting the black hole's sky). */
export function worldLeaves(model) {
  const out = [];
  for (const region of model.regions) {
    const R = region.rect;
    if (region.kind === 'singularity') {
      out.push({ x: R.x, y: R.y, w: R.w, h: R.h, fill: '#eeeeea', edges: { l: 0, t: 0, r: 0, b: 0 } });
      continue;
    }
    for (const l of region.leaves) out.push({ x: R.x + l.x, y: R.y + l.y, w: l.w, h: l.h, fill: l.fill, edges: { l: 0, t: 0, r: 0, b: 0 } });
  }
  return out;
}
