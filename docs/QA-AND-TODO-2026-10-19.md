// DESCRIPTION: Records the Hocomnia local runtime diagnosis, confirmed non-breaking issues, and prioritized product improvements.
// INPUTS: Hocomnia source checkout, localhost:4322 runtime, production build output, and the existing test/import checks.
// OUTPUTS: Evidence-bounded QA record and an actionable improvement backlog.
// DEPENDENCIES: Astro, Keystatic, browser-rendered localhost site, and repository scripts.

# Hocomnia QA and improvement backlog

Checked 19 October 2026 against `/Users/munchhausen/Projects/Hocomnia` and the site served at `http://localhost:4322`.

## Runtime status

- The requested local server is running from this Hocomnia directory (Astro process PID 70667) and the home page returns `200 OK`.
- Browser accessibility inspection found the site map, page content, project links, and the live Illusion Controls panel rendered. The panel exposes labeled controls, help text, and copy/reset actions.
- Route smoke check returned `200` for `/`, `/projects/tesla/3`, `/ideas`, `/gallery/photo-1`, `/keystatic`, `/api/projects.json`, and `/sitemap.xml`.
- `npm run build` succeeds and generates 71 static routes. The built output is 11 MB.
- `npm test` passes: composition, document mapping, importing, and world integrity checks. The world check reports no missing routes, dead links, duplicate IDs, or undersized map regions across its sample and heavy fixtures.
- A non-writing importer dry run converted `test/fixtures/report.html` into a four-slide outline successfully.
- No breaking runtime or build failure was reproduced in this pass.

## Confirmed non-breaking issues

1. **Starter copy is public-facing.** The visible home page currently contains `[Placeholder]` copy and `00%` / `$00M` figures across all five project documents, plus placeholder About and résumé entries. The gallery uses generic “Sample horizon study” captions. This is a content-completion issue rather than a rendering failure. The repository README itself identifies the projects as placeholders.
2. **PDF and PowerPoint are not accepted by the import pipeline.** The current importer is a command-line tool for `.docx`, `.md`/`.mdoc`, `.txt`, and `.html`; DOCX parsing depends on the optional `mammoth` package. It converts supported sources into a project document and slide outline. There is no upload-and-preview flow, and direct `.pdf`/`.pptx` conversion is unsupported.
3. **Motion settings require a manual publish handoff.** The live control panel can copy changed settings as JSON, but its documented workflow is to paste those values into the CMS content file/form. It does not save a tested preset directly into the CMS.
4. **Two local Astro servers make the port ambiguous.** The requested site runs on 4322. Port 4321 is occupied by another Astro checkout at `/Users/munchhausen/Projects/illusional-site/hocomnia.com/hoc-omnia-site`, while the Hocomnia README points developers to 4321. Both can respond with a site bearing the same title, so opening the documented port may show the other checkout.
5. **The build emits a large-client-chunk warning.** Astro warns about minified chunks over 500 kB. The main world bundle is about 744 kB and the particle-globe bundle about 589 kB; this is a load-time/performance concern, not a failed build. The complete `dist` tree is 11 MB.
6. **Production canonical/feed URLs need configuration.** `astro.config.mjs` defaults `SITE_URL` to `https://example.com`. A deployment built without the real site URL can generate incorrect canonical and feed links.
7. **This Hocomnia directory has no Git metadata.** Local editing and builds work, but this checkout cannot commit or push CMS changes. The README's GitHub-backed online editing mode depends on a GitHub repository and its deployment configuration.

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
- Restore Git metadata or clearly label this directory as a source snapshot so CMS save/publish expectations are clear.

## Verification limits

The browser pass confirmed rendered content and the control panel's accessible structure. It did not exercise every camera gesture, publish a CMS edit, profile frame rate, or validate the PDF/PPTX upload experience because that intake flow does not exist yet. No source feature code was changed during this diagnosis; this file is the QA record and next-step list.
