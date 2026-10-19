/**
 * cosmos/content.ts — CMS adapter for the cosmos world
 * ---------------------------------------------------------------------------
 * Settings: the "Cosmos" singleton (Keystatic form generated from
 * COSMOS_SCHEMA, see keystatic.illusion.ts).
 * Modules: mapped from the site's existing six module collections. The map
 * only needs { id, title, summary, items: [{ id, title, body }] }.
 * Anything missing falls back to defaults / sample content.
 */
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../keystatic.config';
import { COSMOS_CONFIG } from './schema.js';
import { SAMPLE_SHOTS, buildModules } from './sample-content.js';
import { bodyHTML } from '../stijl/blog.js';

const reader = () => createReader(process.cwd(), keystaticConfig);

export async function getCosmosConfig() {
  try {
    return COSMOS_CONFIG.merge((await reader().singletons.cosmos.read()) ?? {});
  } catch (error) {
    console.warn('[cosmos] Using default settings.', error);
    return COSMOS_CONFIG.merge({});
  }
}

/**
 * The six regions of the map, filled from the CMS: projects (with their slides
 * mapped from each document), photos, posts, About, Resumé, and the API.
 * See buildModules() in sample-content.js for the shape of each.
 */
export async function getCosmosModules() {
  const { getProjects, getPhotos, getPosts, getPostHTML, getAbout, getResume } = await import('../site/content');
  const [projects, photos, posts, about, resume] = await Promise.all([getProjects(), getPhotos(), getPosts(), getAbout(), getResume()]);
  const withHtml = await Promise.all(posts.map(async (p: any) => ({ ...p, html: (await getPostHTML(p)) ?? bodyHTML(p.body ?? '') })));
  return buildModules({ projects, photos, posts: withHtml, about, resume });
}

/**
 * Shots from the Keystatic "Shots" collection (see keystatic.shots.ts),
 * falling back to the samples. Steps store `to` as text: a route, or
 * "x, y, w" for a raw view; it is converted here.
 */
export async function getCosmosShots() {
  try {
    const entries = await reader().collections.shots.all();
    if (!entries.length) return SAMPLE_SHOTS;
    return entries.map(({ slug, entry }) => ({
      id: slug,
      trigger: { on: entry.trigger, route: entry.route, seconds: entry.idleSeconds },
      loop: entry.loop,
      steps: entry.steps.map((s) => {
        const nums = String(s.to).split(',').map(Number);
        return { ...s, to: nums.length === 3 && nums.every(Number.isFinite) ? nums : s.to, pan: [s.panX ?? 0, s.panY ?? 0] };
      }),
    }));
  } catch {
    return SAMPLE_SHOTS;
  }
}
