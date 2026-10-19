# Cosmos: the site as a world larger than the screen

A physics and mathematics layer on top of the illusion kit. Every motion comes from a published model, not hand-tuned easing.

| Feature | Model | File |
|---|---|---|
| Point and go | van Wijk & Nuij (2003) optimal pan-and-zoom path: the camera climbs just enough to see both places, crosses, descends. Duration ∝ path length. | `math/vanwijk.js`, `camera.js` |
| Cinematic tilt, rising fields | Tilt and lift scale with how far the path climbs above its endpoints (sin(πt) envelope). | `camera.js`, `cosmos.css` |
| Ken Burns tour | Flights between stops; holds push in with constant perceived zoom speed (geometric width, sine ease). | `tour.js` |
| Wheel and pinch zoom | Critically damped spring on log(width) about the cursor. | `math/spring.js` |
| Drag inertia | Viscous friction: v(t) = v₀·e^(−t/τ), τ = 0.32 s. | `camera.js` |
| Rack focus | Thin-lens circle of confusion c = A·f·\|S₂−S₁\| / (S₂(S₁−f)) per layer; focus glides in log distance; focus breathing = v/f. | `math/optics.js`, `rackfocus.js` |
| Black hole | GPU ray tracer: exact Schwarzschild null geodesics (RK4), ISCO disk, Shakura–Sunyaev temperatures, exact circular-orbit redshift g = √(1−3/2r)/(1+Ω·L), g⁴ beaming. | `blackhole.js`, `math/schwarzschild.js` |
| The orbit | Approach and orbit the ray-traced hole; the readout shows distance and the static clock rate √(1−rₛ/r). | `cosmos.js` |
| Sucked home (three.js) | The screen is snapshotted onto a dense three.js plane. Each ring falls on its own free-fall clock (t_ff ∝ r^1.5, r = r₀(1−(t/t_ff)²)^(2/3)); angular momentum makes it spiral (θ ∝ √(r₀/r)); the surface sinks into Flamm's paraboloid; gravitational redshift dims and reddens it near the horizon; radial blur and streaks give the warp-speed feel. It curls into a sphere that spins up as it shrinks (ω ∝ 1/R²), drops and bounces (restitution 0.45), then we zoom into it and it unwraps into the home page. | `warp.js`, `snapshot.js` |
| Shots | Authored camera choreography (flight, Ken Burns hold, title, focus) bound to clicks, page load, idle, or `data-shot` buttons. | `shots.js`, `keystatic.shots.ts` |
| Smooth handling | The camera measures its own velocity: new moves bend out of the current motion (v₀·t·e^(−t/τ)); interruptions hand the velocity to inertia so the camera glides to rest. | `camera.js` |
| Spring letters | Damped harmonic oscillators, pointer as a finite radial force. | `illusion/text/physics-text.js` |
| Wave letters | 1D wave equation, explicit finite differences, CFL sub-stepping, Poisson raindrops. | same |
| Tidal letters | Pull ∝ 1/r², stretch ∝ 1/r³ (spaghettification), dimming by √(1−rₛ/r). The black hole background is the mass when present. | same |

## Sound, more illusions, analog finish

| Feature | How | File |
|---|---|---|
| Sound | Synthesized with the Web Audio API through a "tape" stage (soft saturation, gentle low-pass): mechanical keys, focus-ring detents while the rack focus turns, a felt-mallet thock when the title plaque lands, air rush that follows camera speed, and for the trip home a Shepard–Risset glissando (a tone that falls forever without getting lower), sub rumble, spin-up whine, a click per bounce, a rising rush and a landing thud. Optional room tone with vinyl crackle timed as a Poisson process. Off until the visitor presses Sound (browsers need a gesture); the choice is remembered. | `audio.js` |
| Scintillating grid | Paper discs at grey street crossings over ink squares; dark dots flash in the discs you aren't looking at. | `illusion/backgrounds/grid-illusions.js` |
| Café wall | Shifted rows of tiles with thin grey mortar; parallel lines look wedged. | same |
| Stepping feet | Yellow and blue bars glide at constant speed over stripes and appear to walk. "Hold to see the truth" lifts the stripes. | same |
| Turning rings | Pinna–Brelstaff rings appear to counter-rotate as they grow and shrink. Also the cosmos sky, where zooming supplies the size change. | same, `cosmos.css` |
| Analog finish | Viewfinder bezel with rounded window, vignette, glass reflection and animated film grain; gate weave (the picture shivers a fraction of a pixel, more in motion); canvas weave and pooled-paint relief on every field; keycap buttons with travel; a screwed-on paper plaque with debossed type; an amber lens data strip (focal length, aperture, live focus distance, zoom). | `analog.css`, `analog.tailwind.css`, `cosmos.css` |
| Type sets | Workshop: Jost, Barlow Condensed and Courier Prime. Poster: Big Shoulders and Instrument Sans. Typewriter: Special Elite and Courier Prime. | `analog.css` |

Use the analog pieces anywhere on the site: `.an-key`, `.an-plaque` (+ four `.an-screw`), `.an-deboss`, `.an-emboss`, `.an-lcd`, `.an-paper`, `.an-film`, or the Tailwind utilities `text-deboss`, `text-emboss`, `text-phosphor`, `bg-grain`, `shadow-lift`, `shadow-key`, `shadow-well`, `press`, `font-label`, `font-typewriter`.

## Install

1. `npm install three`. Copy `src/lib/cosmos/`, `src/components/cosmos/`, `src/styles/cosmos.css`, `src/pages/lab/cosmos.astro`, `src/content/cosmos/`, `keystatic.shots.ts` into the project (the illusion kit must already be installed; it was updated too, so replace `src/lib/illusion/` and `src/styles/illusion.css`).
2. In `keystatic.config.ts`: `singletons: { illusion: illusionSingleton, cosmos: cosmosSingleton }` and `collections: { shots: shotsCollection, … }`.
3. Point `getCosmosModules()` in `src/lib/cosmos/content.ts` at the real module collections (it returns sample content until then).
4. Import `analog.css` (and `analog.tailwind.css` after Tailwind) in your global stylesheet, and load Jost, Barlow Condensed, Courier Prime and Special Elite (see the `<link>` in `src/pages/lab/cosmos.astro`).
5. Visit `/lab/cosmos`. In development, the panel opens with **Alt+Shift+I**. **Copy settings** gives JSON for the Cosmos singleton.

## Using it

- Click any field: the camera goes one level deeper (region, then field). With Arrival set to "fill", a colour field zooms until it covers the screen; red, yellow and blue fields hold content too.
- Scroll down or spread fingers to zoom in about the cursor; drag to pan. Scroll up, pinch, Esc, or Overview: the painting yields, then everything is sucked into the singularity and you land home. (Scroll direction is a setting.)
- At the home page, keep pushing back for the cinematic route: approach and orbit the ray-traced hole, then the same warp.
- Clicking Projects plays the sample shot `projects-reveal`; after 60 s idle, the `attract` shot loops. Alt+Shift+V copies the current view as `[x, y, w]` for a shot step.
- Every place is a URL: `#/projects`, `#/projects/illusion-kit`, `#/singularity`. The back button flies back.
- Tab moves through the map; the camera follows keyboard focus. Esc returns to the overview. Arrow keys pan, + and − zoom.

## Decisions

| Decision | Why | Tradeoff |
|---|---|---|
| WebGL only for the black hole | Per-pixel geodesics need the GPU; everything else stays DOM + CSS so text is real text. | One shader to maintain; CSS fallback if WebGL is missing. |
| van Wijk path instead of custom easing | Researched optimum for perceived travel; gives the title-sequence climb for free. | Less art-directable per shot; `Climb` (ρ) is the knob. |
| Level of detail in pure CSS | One custom property per frame instead of a JS loop over every label. | Style recalc over ~100 cells per frame (cheap at this size). |
| World rendered on the server | Content is indexable and readable before JS. | World markup is duplicated in `data-modules` for rebuilds. |
| Hash routing | Back button, deep links, shareable places, keyboard focus. | Hash URLs rather than paths; fine for a single-page map. |
| 3D only while moving | `rotateX` and `preserve-3d` blur text, so they are dropped at rest. | A one-frame re-raster when motion ends. |
| Sky painted into the camera's field of view | The lensed sky matches the overview, so the crossfade into the hole is seamless. | The sky is re-painted when the seed or window size changes. |
| three.js for the warp, not Framer Motion | Motion animates DOM properties; bending pixels around a point needs a mesh and shaders. | Adds three.js (~150 kB gzipped), loaded only when the warp first runs if you code-split it. |
| Hand-written screen snapshot, not html2canvas | Paints only what the cosmos shows (fields, words at their real positions, the card) in a few milliseconds. | Ignores focus blur and anything you add to the map that isn't a field or text. |
| The warp ends by unwrapping into the home page | Its last frame matches the DOM, so the hand-back has no seam. | The home snapshot is taken while the sphere is a few pixels wide. |
| Card recedes to 50% on deep pages | Keeps content under it readable after the focus pull. | Less cinematic; set to 1 in `cosmos.css` for full-strength cards. |

Not modelled: black-hole spin (Kerr), disk thickness, light travel time, aberration for the falling observer. The warp is physically motivated (each motion uses a real law) but it is a stylised picture, not a ray trace.

## Testing

`test/three-shim.js` is a test-only stand-in for the slice of three.js the warp uses, for headless runs without network. The demo build writes `test-cosmos-lab.html` with it inlined. `cosmos.warpHome({ manual: true })` plus `cosmos.warpStep(n)` advance the warp frame by frame (1/30 s each) for deterministic capture, which also works for recording a video of the transition.

## Performance and accessibility

- `Render quality` (bhQuality) is the main cost control: 0.6 is fine on laptops; use 0.35–0.45 for phones. The shader only runs during the fall (or with the black hole background).
- Reduced motion (system setting or the admin preview): flights become cuts, focus pulls become instant, the warp becomes a quick fade through ink, letters stay at rest.
- The warp is the heaviest moment: a dense mesh and ten texture samples per pixel for about five seconds. Lower Warp speed's duration (raise the multiplier) on slow phones, or set Going back to Zoom out.
- The title card is decorative (`aria-hidden`); the real headings are the links in the map and a visually hidden `h1`.
- Sound is off by default and never starts without a click. The grain animation stops under reduced motion, and the gate weave is off there too.
- The scintillating grid, café wall and stepping feet can be uncomfortable for some visitors (and the grid can bother people with migraine). Keep them opt-in or off the main reading pages.
- Check red-on-blue text contrast before using red for labels, and keep the op-art backgrounds optional for visitors sensitive to them.
