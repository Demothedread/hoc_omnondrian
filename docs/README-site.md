> **Note.** This describes the section composer, presentations, gallery and blog as separate pages. In the finished site they all live inside the one traversable world (see the main README); the composer, deck, reading and gallery mechanics below are what that world is built from.

# Sections, presentations, gallery and blog

Every section of the site is a list of items composed by one engine (`src/lib/stijl/compose.js`) under De Stijl rules, and each composition assembles itself on screen in the order it was cut.

## What's here

| Piece | What it does | Files |
|---|---|---|
| Section composer | Guillotine splits where item weights balance (reading order kept), cut across the longer side, off-centre jitter, small accent fields in red, blue, yellow or ink, colour ≤ 37.5%, line weight falling with depth. Composed twice: wide and tall (phones), switched by a container query; content is rendered once. | `stijl/compose.js`, `styles/stijl.css` |
| Assembly | Lines draw in the order they were cut (heaviest first) on a damped-spring curve, then accents settle, then items arrive. Starts when the section scrolls into view; without JS or with reduced motion, the finished composition just shows. | `stijl/assemble.js` |
| Projects | Index of the five projects; each opens as a presentation (full-screen slides, each slide its own composition, ←/→ keys, slide counter, `#slide-N` deep links) or a report (the same blocks as long-form reading with a table of contents). Either format is one click away. | `pages/projects/*`, `stijl/presentation.js`, `stijl/deck.js` |
| Gallery | Photos laid out in Mondrian rooms. Over the first room lies the painting: as you scroll, each field shatters along a finer Mondrian split, the black lines break into segments, and every shard falls away from the screen on a ballistic path (pushed into depth, pulled down by gravity, tumbling). Scroll back and it reassembles. Photos open in a native `<dialog>`. | `pages/gallery.astro`, `stijl/gallery.js`, `stijl/disintegrate.js` |
| Particle globe | Opening a photo gathers it out of a globe of its own pixels (200 columns of particles, each carrying its pixel's colour, morphing between the picture and a Fibonacci sphere in the vertex shader). Hold the photo (pointer, Enter or Space) to form the globe again; release to let it settle. The full-resolution photo fades in once the particles land. Moving to the next photo (Previous/Next keys, ← →, or a swipe) runs the collapse: the photo disintegrates into its globe, the globe falls in on itself (each particle on a staggered, accelerating, spiralling fall), and at the point the next photo, loaded in parallel, bursts out on an under-damped spring (it swells about 10% past full size) and settles into the picture. Rapid presses queue; the latest wins. Motion springs drive one TSL uniform. Loaded only when a photo opens. Falls back to the plain photo without WebGPU/WebGL2; reduced motion shows the still photo. Also a standalone `<ParticleGlobe photos={…} />` that picks a different photo each visit. | `stijl/particle-globe.js`, `stijl/gallery.js`, `components/stijl/ParticleGlobe.astro` |
| Blog | Keystatic posts (Markdoc body, date, summary, colour, draft flag). The index is a composition where newer posts weigh more; each post gets a composed header, a coloured drop cap and newer/older links. RSS at `/rss.xml`. | `pages/blog/*`, `pages/rss.xml.ts`, `stijl/blog.js` |
| Cosmos links | Projects and Ideas fields on the map come from these collections. The first click flies to a field until it fills the screen; a second click (or Enter) opens its page. | `cosmos/content.ts`, `cosmos/world.js`, `cosmos/cosmos.js` |

## Install

1. `npm install @keystatic/core @keystatic/astro @markdoc/markdoc @astrojs/rss three motion` (three ≥ r171 for `three/webgpu` and `three/tsl`), and set `site` in `astro.config.mjs` (the feed needs it).
2. In `keystatic.config.ts`, add `projects: projectsCollection`, `posts: postsCollection` to `collections` and `gallery: gallerySingleton` to `singletons` (from `keystatic.site.ts`).
3. Import `illusion.css`, `analog.css` and `stijl.css` globally, or use `src/layouts/StijlPage.astro`, which does.
4. Fill in the five projects in Keystatic. Every `[Placeholder]` in `src/lib/site/sample.js` marks text to replace; the samples disappear as soon as the collection has entries.

## Using the composer anywhere

```astro
<StijlSection label="Projects" seed={1917}
  items={[{ id: 'tesla', title: 'Tesla', kicker: 'Presentation', summary: '…', href: '/projects/tesla', weight: 1.5 }]} />
```

`weight` is an item's share of the canvas; `tone` is `auto`, `paper`, `red`, `blue` or `yellow`. Use `tall={0.32}` for long lists on phones. `compose={{ accents: 0.5, autoColour: 0.3, cap: 0.375 }}` tunes accents and colour.

## Checks

`node test/compose.test.mjs` composes 3,000 seeds for each of six item counts and aspects: every item placed, fields tile the section exactly with no overlaps, and colour stays under 37.5%. On the cosmos map, 3,000 seeds place every item of every module (busier regions subdivide further, then recompose finer if a split stops short).

## Decisions

| Decision | Why | Tradeoff |
|---|---|---|
| One composer for every section | Projects, slides, gallery rooms and the blog index all read as the same painter's hand. | Long text needs room: use weights, or report mode for prose. |
| Items keep their order | A guillotine split at the weight balance point preserves reading order, so screen readers and the visual order agree. | Less freedom than shuffling for the "best" picture. |
| Wide and tall compositions, content rendered once | Mondrian rules on phones too, without duplicating content for search or screen readers. | Two sets of decorative lines in the markup. |
| Disintegration driven by scroll, not time | Reversible, never plays while you look away, and you control the pace. | Needs a tall scroll track (`.dis` height, default 260svh). |
| Shards are smaller Mondrian rectangles | The painting comes apart by its own grammar, not as generic shatter. | Less "physical" than Voronoi glass. |
| Presentation and report from the same blocks | Write once in the CMS; readers choose. | Slides favour short blocks; very long text belongs in report mode. |
| Particle globe in the lightbox, loaded on demand | three.js (WebGPU build) and Motion are heavy; nobody pays for them until they open a photo. | A short wait the first time a photo opens; the plain photo shows meanwhile. |
| Plain Motion subscription instead of `threeEffect`/`transformValue` | Same behaviour, but works on any Motion 11+ without the `motion/three` entry point. | Swap back to `threeEffect` if you prefer; the comment in the module shows the one-to-one equivalent. |
| Photos read with `crossOrigin = "anonymous"` | The particles need the photo's pixels; photos on a CDN must send CORS headers. | Images from hosts without CORS fall back to the plain photo. |
| Flicker removed | The animated film grain (and gate weave) read as a black flicker. Grain is now a still texture, off by default; weave is off by default. | — |
