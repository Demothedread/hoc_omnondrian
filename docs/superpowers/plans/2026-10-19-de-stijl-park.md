// DESCRIPTION: Tracks implementation of the approved De Stijl park experience.
// INPUTS: The adjacent design spec and the current Astro source.
// OUTPUTS: Modular implementation steps and verification evidence.
// DEPENDENCIES: Motion, Keystatic, mammoth, and Astro.

# De Stijl Park Implementation Plan

**Goal:** Build the approved destination choreography, illustrated résumé journey, editorial projects and document studio.
**Architecture:** Keep camera/router ownership in Cosmos. Isolate transient plate animation, park navigation/host behavior, editorial rendering and local authoring I/O in separate modules.
**Tech Stack:** Astro, vanilla JavaScript, Motion, Keystatic, mammoth.
**Spec:** ../specs/2026-10-19-de-stijl-park-design.md

## Tasks

- [x] Add `plates.js`: cancellable begin/finish/cancel/destroy animation controller; keep camera transforms independent using a stage wrapper.
- [x] Add `journey.js` and `park-ui.js`: pure station model plus navigable map index, local section index, host/commentary and journey controls; extend CMS fields and world routes.
- [x] Add `editorial.js` and styles; use the same renderer for world slides and studio previews. Preserve all blocks and source order.
- [x] Add browser Project Studio and a development-only middleware save endpoint. Parse DOCX in-browser; validate source and write new entries exclusively. Reorder semantic sections and preserve embedded images.
- [x] Run world/import tests and production build; inspect representative destination and studio flows in browser. Record limits and open issues in QA notes.

## Review focus

- Rapid navigation cancels old plate/host callbacks.
- Reduced motion changes during a visit reveal content without a hidden stuck layer.
- Empty/duplicate résumé headings produce unique station routes.
- Long project content remains readable and scrollable in a narrow viewport.
- Importing untrusted names, duplicate slugs, invalid documents or embedded image data cannot overwrite files or silently drop content.

Execution follows the user's explicit request to implement Approach 1 in this session.
