// node test/compose.test.mjs — statistical check of the section composer
import { composeSection, springEasing } from '../src/lib/stijl/compose.js';
const cases = [[5, 1.6], [5, 0.6], [12, 1.6], [12, 0.6], [4, 16 / 9], [8, 1.0]];
for (const [n, aspect] of cases) {
  let worstCover = 0, minSide = Infinity, minShare = Infinity, bad = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const items = Array.from({ length: n }, (_, i) => ({ id: `i${i}`, weight: i === 0 ? 1.6 : 1 }));
    const L = composeSection({ seed, items, aspect });
    const placed = L.leaves.filter((l) => l.kind === 'item').length;
    const total = L.leaves.reduce((a, l) => a + l.w * l.h, 0);
    // overlap check (pairwise, in % space)
    let overlap = 0;
    for (let a = 0; a < L.leaves.length; a++) for (let b = a + 1; b < L.leaves.length; b++) {
      const p = L.leaves[a], q = L.leaves[b];
      const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
      const oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (ox > 0.01 && oy > 0.01) overlap++;
    }
    if (placed !== n || overlap || Math.abs(total - 10000) > 1) bad++;
    worstCover = Math.max(worstCover, L.coverage);
    for (const l of L.leaves.filter((l) => l.kind === 'item')) {
      // shorter side in "section heights" (x% of width → scale by aspect)
      minSide = Math.min(minSide, Math.min((l.w / 100) * aspect, l.h / 100));
      minShare = Math.min(minShare, (l.w * l.h) / 10000);
    }
  }
  console.log(`${n} items @ ${aspect.toFixed(2)}: bad=${bad} maxColour=${worstCover.toFixed(3)} minItemSide=${minSide.toFixed(3)}H minItemArea=${(minShare * 100).toFixed(1)}%`);
}
console.log(springEasing());
