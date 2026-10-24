// DESCRIPTION: Configures the static portfolio, local CMS and isolated development/build caches.
// INPUTS: Astro command, SITE_URL and optional GitHub CMS configuration.
// OUTPUTS: Astro integrations, strict local server and Vite configuration.
// DEPENDENCIES: Astro, React, Markdoc, Keystatic, Tailwind and Studio middleware.
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
import { studioDevelopmentPlugin } from './src/lib/studio/server.mjs';

const building = process.argv.includes('build');
const online = Boolean(process.env.KEYSTATIC_GITHUB_REPO);
const adapter = online ? (await import('@astrojs/vercel')).default() : undefined; // OPTION: @astrojs/netlify, @astrojs/node

export default defineConfig({
  server: { host: '127.0.0.1', port: 4322 },
  site: process.env.SITE_URL ?? 'https://example.com', // used by the RSS feed and canonical URLs
  // The CMS admin is only built into the site for online editing.
  integrations: [react(), markdoc(), ...(building && !online ? [] : [keystatic()])],
  adapter,
  vite: {
    // Build omits the local CMS integration, so it must not invalidate the running dev optimizer.
    cacheDir: building ? 'node_modules/.vite-build' : 'node_modules/.vite-dev',
    server: { strictPort: true },
    plugins: [tailwindcss(), studioDevelopmentPlugin(process.cwd())],
  },
});
