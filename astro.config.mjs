// astro.config.mjs
// ---------------------------------------------------------------------------
// Two ways to run the CMS:
//   Local (default)  `npm run dev`, edit at /keystatic, changes are saved as files
//                    in src/content/. `npm run build` makes a fully static site.
//   Online           set KEYSTATIC_GITHUB_REPO=owner/repo (plus the Keystatic GitHub
//                    app keys, see README) and deploy with an adapter: edits on the
//                    live site commit to GitHub, which rebuilds the site.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import tailwindcss from '@tailwindcss/vite';

const building = process.argv.includes('build');
const online = Boolean(process.env.KEYSTATIC_GITHUB_REPO);
const adapter = online ? (await import('@astrojs/vercel')).default() : undefined; // OPTION: @astrojs/netlify, @astrojs/node

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://example.com', // used by the RSS feed and canonical URLs
  // The CMS admin is only built into the site for online editing.
  integrations: [react(), markdoc(), ...(building && !online ? [] : [keystatic()])],
  adapter,
  vite: { plugins: [tailwindcss()] },
});
