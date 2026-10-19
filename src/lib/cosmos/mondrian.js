/**
 * cosmos/mondrian.js — seeded guillotine compositions
 * ---------------------------------------------------------------------------
 * A compact version of the site's layout engine (seeded guillotine BSP,
 * forced off-centre root cross, 37.5% colour cap) that works at any scale.
 * The cosmos world uses it twice: once for the kingdoms of the map, and
 * again inside each kingdom for its provinces. The black hole paints the
 * same compositions onto the sky it lenses.
 *
 * OPTION: swap composeBSP for the site's own engine; it only needs to return
 * leaves of { x, y, w, h, edges: { l, t, r, b } } in world units.
 */
import { STIJL, seededRandom } from '../illusion/config.js';

/**
 * @param {object} o
 * @param {number} o.seed
 * @param {{x:number,y:number,w:number,h:number}} o.rect
 * @param {number} o.depth          maximum split depth
 * @param {number} o.minSize        never produce a leaf narrower than this
 * @param {(depth:number) => number} o.line   line weight for a split at depth
 * @param {{l:number,t:number,r:number,b:number}} [o.frame]  weights of the outer edges
 * @param {boolean} [o.cross]       force the off-centre root cross (default true)
 * @param {number} [o.stopChance]   chance a node stays whole once depth ≥ 2
 */
export function composeBSP({ seed, rect, depth, minSize, line, frame, cross = true, stopChance = 0.18 }) {
  const rand = seededRandom(seed);
  const leaves = [];
  const outer = frame ?? { l: line(0), t: line(0), r: line(0), b: line(0) };

  function split(node, d, forceAxis) {
    const { w, h } = node;
    const canV = w >= minSize * 2.2;
    const canH = h >= minSize * 2.2;
    const stop = d >= depth || (!canV && !canH) || (d >= 2 && rand() < stopChance);
    if (stop && forceAxis == null) { leaves.push({ ...node, d }); return; }

    // Split the longer side, like Mondrian, unless the cross forces an axis.
    let vertical = forceAxis ?? (w / h > 1.15 ? true : h / w > 1.15 ? false : rand() < 0.5);
    if (vertical && !canV) vertical = false;
    if (!vertical && !canH) vertical = true;
    // Off-centre ratios: never halves, never slivers.
    const side = rand() < 0.5;
    const t = side ? 0.28 + rand() * 0.16 : 0.56 + rand() * 0.16;
    const weight = line(d);

    if (vertical) {
      const cut = node.x + w * t;
      const a = { x: node.x, y: node.y, w: cut - node.x, h, edges: { ...node.edges, r: weight } };
      const b = { x: cut, y: node.y, w: node.x + w - cut, h, edges: { ...node.edges, l: weight } };
      const next = forceAxis === true && cross ? false : undefined; // second half of the cross
      split(a, d + 1, next); split(b, d + 1, next);
    } else {
      const cut = node.y + h * t;
      const a = { x: node.x, y: node.y, w, h: cut - node.y, edges: { ...node.edges, b: weight } };
      const b = { x: node.x, y: cut, w, h: node.y + h - cut, edges: { ...node.edges, t: weight } };
      split(a, d + 1); split(b, d + 1);
    }
  }

  split({ ...rect, edges: outer }, 0, cross ? true : undefined);
  return leaves;
}

/**
 * Colour leaves under a coverage cap, preferring mid-sized fields (large
 * fields read as walls of colour; tiny ones as noise). Returns the leaves
 * with a `fill`. Leaves in `reserve` stay paper (content lives there).
 */
export function colourLeaves(leaves, { seed, cap = 0.375, reserve = new Set(), hues = [STIJL.red, STIJL.blue, STIJL.yellow] }) {
  const rand = seededRandom(seed ^ 0x9e3779b9);
  const total = leaves.reduce((a, l) => a + l.w * l.h, 0);
  const scored = leaves
    .map((l, i) => {
      const f = (l.w * l.h) / total;
      return { i, f, score: f * (1 - f * 4) * (0.5 + rand()) };
    })
    .filter((s) => !reserve.has(s.i))
    .sort((a, b) => b.score - a.score);

  const out = leaves.map((l) => ({ ...l, fill: STIJL.paper }));
  let covered = 0;
  let h = Math.floor(rand() * hues.length);
  for (const s of scored) {
    if (covered + s.f > cap) continue;
    if (covered > cap * 0.55 && rand() < 0.5) continue; // leave breathing room
    out[s.i].fill = hues[h++ % hues.length];
    covered += s.f;
  }
  return out;
}

/** Inset a leaf by half of each edge's line weight: the ink ground shows as lines. */
export function insetRect(l) {
  const { l: el, t, r, b } = l.edges;
  return { x: l.x + el / 2, y: l.y + t / 2, w: l.w - (el + r) / 2, h: l.h - (t + b) / 2 };
}

/**
 * Paint leaves onto a 2D canvas (ink ground + fields). Used to make the sky
 * texture the black hole bends, so the lensed image is the site itself.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} leaves     coloured leaves
 * @param {{x:number,y:number,w:number,h:number}} view  world rect mapped to the canvas
 */
export function paintLeaves(ctx, leaves, view) {
  const { width, height } = ctx.canvas;
  const sx = width / view.w;
  const sy = height / view.h;
  ctx.fillStyle = STIJL.ink;
  ctx.fillRect(0, 0, width, height);
  for (const l of leaves) {
    const r = insetRect(l);
    ctx.fillStyle = l.fill;
    ctx.fillRect((r.x - view.x) * sx, (r.y - view.y) * sy, Math.max(0.5, r.w * sx), Math.max(0.5, r.h * sy));
  }
}

/**
 * A ready-made sky for the black hole: an equirectangular canvas (2:1)
 * holding one Mondrian composition. Seamless left/right is not needed; the
 * seam sits behind the camera.
 */
export function paintSky(seed, width = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width / 2;
  const rect = { x: 0, y: 0, w: 2000, h: 1000 };
  const leaves = colourLeaves(
    composeBSP({ seed, rect, depth: 6, minSize: 60, line: (d) => [16, 12, 9, 7, 5, 4][Math.min(d, 5)] }),
    { seed },
  );
  paintLeaves(canvas.getContext('2d'), leaves, rect);
  return canvas;
}
