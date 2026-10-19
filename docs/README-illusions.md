# Illusion kit

Depth and motion for the site without WebGL or animation libraries. Most of
the effect happens in the visitor's visual system, not on the GPU: three of
the eight headline effects and two of the three backgrounds don't animate
anything at all.

## Files

| File | What it does |
| --- | --- |
| `src/lib/illusion/config.js` | Defaults, the admin/CMS schema, validation. Add a knob here and it appears in the panel and the CMS. |
| `src/lib/illusion/store.js` | Tiny observable store (stage reads, admin writes). |
| `src/lib/illusion/stage.js` | Mounts modules, one shared animation clock, pauses off-screen. |
| `src/lib/illusion/registry.js` | id → module map. Register new illusions here. |
| `src/lib/illusion/backgrounds/droste.js` | Infinite descent (self-similar Mondrian loop). |
| `src/lib/illusion/backgrounds/static-illusions.js` | Floating island (Ouchi), peripheral drift (Kitaoka), plain. |
| `src/lib/illusion/text/motion-defined.js` | Headline visible only while it moves. |
| `src/lib/illusion/text/afterimage.js` | Headline painted by the viewer's afterimage. |
| `src/lib/illusion/text/css-effects.js` | Crawling, lenticular, floating red, anaglyph, floating letters, plain. |
| `src/lib/illusion/admin.js` | Admin panel, generated from the schema. |
| `src/lib/illusion/boot.js` | Client entry; handles Astro View Transitions. |
| `src/lib/illusion/content.ts` | CMS adapter (Keystatic default, Sanity option). |
| `src/components/illusion/IllusionStage.astro` | The stage section. |
| `src/components/illusion/IllusionAdmin.astro` | The docked panel (dev/editor only). |
| `src/styles/illusion.css` | All illusion drawing. Plain CSS, alternatives in `OPTION:` comments. |
| `src/styles/illusion-admin.css` | Panel styles, never shipped to public pages. |
| `src/styles/illusion.tailwind.css` | Tailwind v4 tokens and utilities (`drift-rail`, `ouchi-field`, …). |
| `keystatic.illusion.ts` | No-code CMS form, generated from the schema. |
| `src/content/illusion/index.json` | The published settings. |
| `src/pages/lab/illusions.astro` | Playground page. |

## Install

1. Copy the files into the repo at the same paths.
2. `npm i @keystatic/core @keystatic/astro` (skip if Keystatic is already set up).
3. Add `illusionSingleton` to `keystatic.config.ts` (see the header of `keystatic.illusion.ts`).
4. In the global stylesheet: `@import "./illusion.tailwind.css";` after `@import "tailwindcss";`.
5. Open `/lab/illusions` in dev. Press Alt+Shift+I to toggle the panel.

Editing workflow: experiment in the panel, press **Copy settings**, then either
paste into `src/content/illusion/index.json` or set the same fields at
`/keystatic`. The panel only exports values that differ from the defaults.

## Decisions

| Decision | Instead of | Why |
| --- | --- | --- |
| Droste zoom is exponential, `(1/r)^p`, driven by rAF | CSS keyframes from scale 1 to 1/r | Linear scale interpolation slows within each level, so the loop visibly pulses at the seam. |
| Every Droste level carries its own frame | Frameless top level | Level N+1 scaled up must be identical to level N, or the loop pops. |
| Droste color capped at 37.5% | Free color choice | Same De Stijl rule the layout engine enforces. |
| Kitaoka ramp built from black, blue, paper, yellow | Kitaoka's original grays | Mondrian's palette is already the right luminance ladder; no off-palette colors needed. |
| Ouchi tremor is a 3px circle on a shared clock | Relying on scroll only | The illusion needs retinal slip; a full-screen stage often doesn't scroll. |
| Motion text on canvas at 1/grain resolution | DOM or SVG noise | 60k cells per frame is cheap on canvas and impossible to do well in DOM. |
| Chromostereopsis uses a brighter red and blue than the palette | Palette red on palette blue | The float scales with saturation; the on-brand pair is kept as an `OPTION:`. |
| Schema generates panel and CMS | Two hand-written forms | They can't drift apart. |
| One rAF clock per stage, paused off-screen | Per-module loops | Predictable cost, no battery drain in background tabs. |

## Accessibility

- Real headline text is always in the DOM (visually hidden when decorated).
- `prefers-reduced-motion`: descent holds a still frame, motion text shows plain type, tremor stops, automatic lenticular sway stops. Admins can preview this state.
- Peripheral drift and Ouchi patterns contain no motion, but strong op-art can be uncomfortable for some visitors, and chromostereopsis red-on-blue has low contrast. Keep these to hero moments and keep body copy off them.
- Nothing flashes; the afterimage swap is a 0.25s fade on a 10s+ cycle.
