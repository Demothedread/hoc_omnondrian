/** /sitemap.xml — every place in the world, for search engines. */
import { getCosmosModules } from '../lib/cosmos/content';
import { worldRoutes } from '../lib/cosmos/world.js';

export async function GET(context: { site: URL }) {
  const places = worldRoutes(await getCosmosModules());
  const base = import.meta.env.BASE_URL;
  const site = context.site ?? new URL('http://localhost:4321');
  const urls = places.map((p) => `  <url><loc>${new URL(`${base}${p.route}`.replace(/\/{2,}/g, '/'), site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { 'Content-Type': 'application/xml' } });
}
