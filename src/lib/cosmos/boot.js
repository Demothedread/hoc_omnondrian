/**
 * cosmos/boot.js — client entry for CosmosWorld.astro
 * ---------------------------------------------------------------------------
 * Reads the server-rendered config and modules, creates the store (with the
 * cosmos schema), starts the world, and registers it so IllusionAdmin can
 * attach. Handles Astro View Transitions like the illusion boot does.
 */
import { createIllusionStore } from '../illusion/store.js';
import { registerStage, getStage } from '../illusion/boot.js';
import { COSMOS_CONFIG } from './schema.js';
import { createCosmos } from './cosmos.js';

function boot(el) {
  if (getStage(el)) return;
  const initial = JSON.parse(el.dataset.config || '{}');
  const modules = JSON.parse(el.dataset.modules || '[]');
  const shots = JSON.parse(el.dataset.shots || '[]');
  const storageKey = el.hasAttribute('data-persist') ? `cos:${el.id || 'world'}` : null;
  const store = createIllusionStore(initial, { storageKey, config: COSMOS_CONFIG });
  const stage = createCosmos(el, store, {
    modules, shots, subline: el.dataset.subline ?? '',
    base: el.dataset.base || '/',
    particles: () => import('../stijl/particle-globe.js'),   // three.js and Motion load only when a photo opens
  });
  registerStage(el, { store, stage });
}

const bootAll = () => document.querySelectorAll('[data-cosmos]').forEach(boot);
document.addEventListener('astro:page-load', bootAll);
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll('[data-cosmos]').forEach((el) => getStage(el)?.stage.destroy());
});
if (document.readyState !== 'loading') bootAll();
else document.addEventListener('DOMContentLoaded', bootAll, { once: true });
