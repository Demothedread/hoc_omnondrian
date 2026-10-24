// DESCRIPTION: Records the Hocomnia local runtime diagnosis, confirmed non-breaking issues, and prioritized product improvements.
// INPUTS: Hocomnia source checkout, localhost:4322 runtime, production build output, and the existing test/import checks.
// OUTPUTS: Evidence-bounded QA record and an actionable improvement backlog.
// DEPENDENCIES: Astro, Keystatic, browser-rendered localhost site, and repository scripts.

# Hocomnia QA and improvement backlog

Latest follow-up: see [24 October continuous-board audit](QA-AND-TODO-2026-10-24.md) for the endless painting, persistent station IDs, authoring repairs, cache isolation and current recommendations.

Checked 19 October 2026 against `/Users/munchhausen/Projects/Hocomnia` and the site served at `http://localhost:4322`.

## Park implementation update

Approach 1 is implemented in the live Hocomnia checkout. The site now has cancellable Motion title plates, an illustrated About greeting, numbered résumé stations with editable commentary and related-destination detours, a destination/section index, content-aware magazine spreads, and Project Studio at `/studio`.

The studio accepts Markdown/Markdoc, DOCX and text, previews the same editorial renderer used in the world, preserves source sections while reordering, exports `.mdoc`, and saves new local CMS drafts without overwriting existing entries. Actual browser verification converted a DOCX and a Markdown document into four spreads; moving Findings before Context persisted in the saved draft. Those QA-only draft files were removed after checking them, and were never public.

Current checks: `npm test` passes; world fixtures have zero missing routes, dead links or duplicate IDs; new checks cover station uniqueness, spread geometry, source-preserving reorder and exclusive draft saving. Production build produces 79 pages. Browser checks confirm About greeting, a personal station, the gallery detour with continuing guide commentary, and editorial project content. Representative screenshots are in `docs/screenshots/park/`.

Additional root repairs from visual verification: the camera canvas uses `overflow: clip` so focusing a guide control cannot scroll the world; deep links reveal their parent compositions; shared palette tokens now exist outside the illusion demo; magazine pages keep a 1.4 aspect ratio within arbitrary map fields. The controls start collapsed and link to Studio and CMS.

Git metadata is currently present. The dev URL is pinned to 127.0.0.1:4322 with strict-port handling. The earlier port and repository warnings below describe the initial diagnosis; the earlier Vite reload issue was rechecked after restarting on the explicit port. A dependency/config restart briefly interrupted preview requests, then recovered.

Remaining limits: career entries still need real data; PDF/PPTX/OCR remain unsupported; table/code/Word-layout fidelity is incomplete; very large studio previews can exceed browser session-storage quota; station URLs should receive immutable IDs before résumé reordering must preserve bookmarks. Frame-rate profiling and named CMS motion presets remain to do. See `docs/DE-STIJL-PARK-GUIDE.md` for the current workflow.

## Initial runtime diagnosis

- The requested local server is running from this Hocomnia directory (Astro process PID 70667) and the home page returns `200 OK`.
- The first visual browser inspection showed a blank cream canvas even though the full map markup and colored cells existed in the DOM. `.cos` measured `0px` high because its unlayered `height: 100%` rule overrode the Tailwind `h-dvh` utility while `body` had no explicit height. The camera then fitted the zero-height canvas and scaled the map to roughly one pixel.
- Fixed the root sizing rule in `src/styles/cosmos.css` to size the Cosmos scene to the viewport (`100dvh`). A fresh load measures `1280 × 720`; the Mondrian-style map with colored portfolio regions is visible across the canvas.
- A fresh direct load of `/ideas` returns `200 OK`, has the expected title `Ideas — Hoc omnia nihil est`, shows the Ideas destination in the map HUD, and has a full-height canvas. The earlier open Chrome tab titled “Not found” was stale; the route is generated from current content and is not currently missing.
- Browser accessibility inspection also found the site map, page content, project links, and live Illusion Controls panel. The panel exposes labeled controls, help text, and copy/reset actions.
- Route smoke check returned `200` for `/`, `/projects/tesla/3`, `/ideas`, `/gallery/photo-1`, `/keystatic`, `/api/projects.json`, and `/sitemap.xml`.
- `npm run build` succeeds and generates 71 static routes. The built output is 11 MB.
- `npm test` passes: composition, document mapping, importing, and world integrity checks. The world check reports no missing routes, dead links, duplicate IDs, or undersized map regions across its sample and heavy fixtures.
- A non-writing importer dry run converted `test/fixtures/report.html` into a four-slide outline successfully.
- No current HTTP 400 or missing-home route was reproduced. The confirmed blank-page rendering defect is fixed. The Vite hot-reload WebSocket previously reported connection failures to ports 4322 and 4321; this affects development hot reload and should be rechecked separately, while a manual page reload receives the current site.

## Confirmed non-breaking issues

1. **Starter copy is public-facing.** Project and résumé entries still contain `[Placeholder]` copy and `00%` / `$00M` figures across all five project documents, plus placeholder résumé entries. About now has the new introduction and guide greeting. The gallery uses generic “Sample horizon study” captions. This is a content-completion issue rather than a rendering failure. The repository README itself identifies the projects as placeholders.
2. **PDF and PowerPoint remain unsupported.** Project Studio provides browser upload, preview, reordering and local CMS draft saving for Markdown, DOCX and text. Mammoth is now a required dependency and loads only when converting DOCX. PDF, PPTX and OCR still need format adapters, extraction diagnostics and review fixtures.
3. **Motion settings require a manual publish handoff.** The live control panel can copy changed settings as JSON, but its documented workflow is to paste those values into the CMS content file/form. It does not save a tested preset directly into the CMS.
4. **Initial port ambiguity (resolved).** The requested site runs on 4322. Port 4321 is occupied by another Astro checkout at `/Users/munchhausen/Projects/illusional-site/hocomnia.com/hoc-omnia-site`, while the Hocomnia README points developers to 4321. Both can respond with a site bearing the same title, so opening the documented port may show the other checkout.
5. **Initial Vite hot reload warning (rechecked).** The browser console reported WebSocket failures to 4322 and 4321, so source changes may require a manual reload during local development.
6. **The build emits a large-client-chunk warning.** Astro warns about minified chunks over 500 kB. The current world bundle is approximately 807 KiB, the particle bundle 529 KiB and the lazy DOCX converter 292 KiB. Frame-time profiling and further splitting remain pending.
7. **Production canonical/feed URLs need configuration.** `astro.config.mjs` defaults `SITE_URL` to `https://example.com`. A deployment built without the real site URL can generate incorrect canonical and feed links.
8. **Initial missing Git metadata (resolved).** Git metadata is now present. Originally, Local editing and builds work, but this checkout cannot commit or push CMS changes. The README's GitHub-backed online editing mode depends on a GitHub repository and its deployment configuration.

## Prioritized to-do list

### P0 — Finish the actual site content

- Replace every public `[Placeholder]` field and zero-value example with approved project copy, figures, and résumé/About content, or remove example entries from the published index until they are ready.
- Add a pre-publish content check that flags placeholder markers and suspicious zero-value figures without blocking deliberate uses in drafts.

### P1 — Make document-to-site conversion feel like uploading work

- Add a CMS intake screen with drag-and-drop and file selection for DOCX, PDF, and PPTX, alongside Markdown and text.
- Convert each format through explicit adapters: preserve headings, hierarchy, notes, tables, images, captions, and source order; OCR scanned PDFs only when needed and report uncertain extraction.
- Show a preview of the proposed site-native pages/slides, retain a link to the source, and let the author correct section boundaries and block types before saving a draft.
- Keep the pipeline safe and understandable: show extraction progress and validation errors, never overwrite an existing project silently, and offer a clear review/publish step after conversion.
- Add conversion fixtures for varied real-world documents, including image-heavy and malformed files, and verify the output against the preview rather than only checking parser internals.

### P1 — Reduce friction in the no-code admin

- Separate content editing from visual/motion tuning in the CMS, with plain-language descriptions and sensible presets for common motion profiles.
- Let editors save and name a tested live settings preset into CMS-managed content from the control panel, with preview, undo, and a visible unsaved/published state.
- Organize the long settings panel into searchable/collapsible groups and provide a compact mobile layout; retain keyboard access, focus management, and readable range values.
- Add a non-destructive “preview this setting” mode and per-control reset so one experiment does not require resetting the entire panel.

### P2 — Improve motion smoothness and accessibility

- Profile the world and photo-viewer bundles on desktop and mobile before changing animation code; lazy-load route-specific visual systems and split optional particle/WebGL paths from the first page load.
- Measure frame pacing during camera flights, composition assembly, singularity transitions, and gallery changes. Tune easing and duration against observed frame times, and avoid stacking effects that compete for attention.
- Verify reduced-motion behavior for every transition and keep a predictable immediate fallback when WebGL/WebGPU or a device's performance budget is unavailable.
- Add touch-specific checks for swipes, panning, and zoom so gestures remain smooth without blocking scroll or keyboard navigation.

### P2 — Make local and production setup clearer

- Choose one canonical checkout and document one unambiguous dev URL; detect a busy port instead of silently serving on the next port when that could open a different copy.
- Require or validate `SITE_URL` for production builds so canonical URLs, RSS, and sitemap output cannot retain the example domain unnoticed.
- Document the current Git-backed CMS publishing setup; Git metadata is present.

## Verification limits

The final browser pass covered About, station navigation, a gallery detour and return, desktop/390px editorial layouts, DOCX and Markdown imports, section reordering, local draft persistence through reload, rapid destination replacement, interruption by camera controls, and reduced-motion preview. Mobile navigation clears wrapped camera controls. No console errors were observed in these checked views. The viewport is refitted after rotation during a flight. This is not exhaustive device or gesture coverage; production CMS publishing, frame-rate profiling and PDF/PPTX conversion remain unverified or unimplemented. Final `npm test`, `npm run build` (79 pages), and `git diff --check` passed.
