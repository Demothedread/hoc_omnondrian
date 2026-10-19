/**
 * illusion/boot.js
 * ---------------------------------------------------------------------------
 * Client entry used by IllusionStage.astro. Boots every stage on the page,
 * and plays well with Astro's View Transitions (ClientRouter):
 *   astro:page-load   → boot stages in the new page (also fires on first load)
 *   astro:before-swap → tear down the old page's clocks and listeners
 *
 * Each stage announces itself with an "illusion:ready" event carrying its
 * store, which is how the admin panel finds what to control.
 */
import { createIllusionStore } from './store.js';
import { createStage } from './stage.js';
import { REGISTRY } from './registry.js';

const live = new Map(); // element → { store, stage }

export function bootStage(el) {
  if (live.has(el)) return live.get(el);
  const initial = JSON.parse(el.dataset.config || '{}');
  // data-persist keeps admin experiments across reloads (per browser, per stage id).
  const storageKey = el.hasAttribute('data-persist') ? `ill:${el.id || 'stage'}` : null;
  const store = createIllusionStore(initial, { storageKey });
  const stage = createStage(el, store, REGISTRY);
  const entry = { store, stage };
  live.set(el, entry);
  el.dispatchEvent(new CustomEvent('illusion:ready', { bubbles: true, detail: { store, element: el } }));
  return entry;
}

export function getStage(el) {
  return live.get(el) ?? null;
}

/**
 * Register any controllable stage (the cosmos world uses this) so
 * IllusionAdmin.astro can find its store and schema by element id.
 */
export function registerStage(el, entry) {
  live.set(el, entry);
  el.dispatchEvent(new CustomEvent('illusion:ready', { bubbles: true, detail: { store: entry.store, element: el } }));
}

function bootAll() {
  document.querySelectorAll('[data-ill-stage]').forEach(bootStage);
}

function teardownAll() {
  live.forEach(({ stage }) => stage.destroy());
  live.clear();
}

document.addEventListener('astro:page-load', bootAll);
document.addEventListener('astro:before-swap', teardownAll);
// Without ClientRouter, astro:page-load never fires: boot directly.
if (document.readyState !== 'loading') bootAll();
else document.addEventListener('DOMContentLoaded', bootAll, { once: true });
