/**
 * illusion/store.js
 * ---------------------------------------------------------------------------
 * A tiny observable store. The stage renders from it; the admin panel writes
 * to it. No framework needed, so it works inside any Astro island or none.
 *
 * Persistence is optional and per-browser (localStorage). It exists so an
 * admin can experiment across reloads; the published values live in the CMS.
 */
import { ILLUSION_CONFIG } from './config.js';

function readSaved(storageKey) {
  if (!storageKey) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    return {};
  }
}

function writeSaved(storageKey, state) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* storage full or blocked: experimenting still works, it just won't persist */
  }
}

/**
 * @param {object} initial   config from the CMS (or {} for defaults)
 * @param {{storageKey?: string|null, config?: ReturnType<import('./config.js').defineConfig>}} [options]
 *        config: which schema toolkit validates values (default: the illusion stage's)
 */
export function createIllusionStore(initial = {}, { storageKey = null, config = ILLUSION_CONFIG } = {}) {
  const mergeConfig = config.merge;
  let state = mergeConfig({ ...initial, ...readSaved(storageKey) });
  const listeners = new Set();
  const notify = (prev) => listeners.forEach((fn) => fn(state, prev));

  return {
    config,
    get: () => state,

    /** Shallow-merge a patch, re-validate, persist, notify. */
    set(patch) {
      const prev = state;
      state = mergeConfig({ ...state, ...patch });
      writeSaved(storageKey, state);
      notify(prev);
    },

    /** Back to the CMS values, and forget local experiments. */
    reset() {
      const prev = state;
      state = mergeConfig(initial);
      try { if (storageKey) localStorage.removeItem(storageKey); } catch { /* ignore */ }
      notify(prev);
    },

    /** @returns {() => void} unsubscribe */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
