// DESCRIPTION: Coordinates Cosmos camera, routing, world effects and destination lifecycles.
// INPUTS: World DOM, validated store, content modules, shots and base URL.
// OUTPUTS: Navigable portfolio runtime and explicit teardown controls.
// DEPENDENCIES: Cosmos camera/effects, isolated park modules, Motion and gallery viewer.
/**
 * cosmos/cosmos.js — the world, the camera and everything that moves them
 * ---------------------------------------------------------------------------
 * Layers, back to front (each at a physical distance for the rack focus):
 *   far   60 m   sky: ink with paper stars, slight parallax
 *   map   5 m    the world plane (world.js), transformed by the camera
 *   near  1.2 m  title card: place names, with a physics text effect
 *   hole         ray-traced black hole (WebGL), during the cinematic fall
 *   warp         three.js canvas, during the trip home (warp.js)
 *   HUD          breadcrumb, tour, fall button (never blurred)
 *
 * Navigation is URL-driven: /projects, /projects/tesla, /projects/tesla/3
 * (fragments, #/projects…, in single-file demos). Every place on the site is
 * a place in this world. Map links are real links: the back button works, deep
 * links work, and keyboard users Tab through the map (the camera follows).
 *
 * Clicking a colour field tracks and zooms to it until it fills the screen
 * (Arrival: fill) or frames it (Arrival: frame).
 *
 * Going home (returnHome = 'hole'): pinching in, scrolling back, Esc or
 * "Overview" sucks whatever is on screen into a singularity, curls the site
 * into a tiny sphere, drops it, and zooms into it to land on the main page
 * (warp.js). The painting yields a little first, so small gestures don't
 * trigger it. At the main page, pushing back further takes the cinematic
 * route: approach and orbit the ray-traced hole, then the same warp.
 *
 * Shots (shots.js): authored camera moves bound to clicks, load, idle, or any
 * element with data-shot="id". The "Play tour" button is a shot built from
 * the modules.
 */
import { worldModel, renderWorldHTML, worldLeaves, WORLD } from './world.js';
import { paintLeaves } from './mondrian.js';
import { createCamera } from './camera.js';
import { createRackFocus } from './rackfocus.js';
import { createDirector, normalizeShot } from './shots.js';
import { createBlackHole } from './blackhole.js';
import { createWarp } from './warp.js';
import { snapshotCosmos } from './snapshot.js';
import { createSound } from './audio.js';
import { pinnaTile } from '../illusion/backgrounds/grid-illusions.js';
import { timeDilation } from './math/schwarzschild.js';
import { REGISTRY } from '../illusion/registry.js';
import { escapeHtml } from '../illusion/config.js';
import { mountLightbox } from '../stijl/gallery.js';
import { createDestinationPlates } from './plates.js';
import { parkMarkup, mountParkUI } from './park-ui.js';
import { boardTile, mountContinuum, repeatedDestination } from './continuum.js';

const PUSH_THRESHOLD = 900;  // wheel delta at the main page before the cinematic fall
const HOME_THRESHOLD = 260;  // wheel delta inside the map before being sucked home
                             // OPTION: 120 (hair trigger) | 500 (deliberate)
const LAYER_MM = { near: 1200, map: 5000, far: 60000 };

/** Full inner markup of a cosmos root. Used by Astro on the server and by the demo. */
export function cosmosMarkup(model, cfg, subline = '', { base = '/' } = {}) {
  return `
  <div class="cos-layer cos-layer--far" data-layer="far" aria-hidden="true"><div class="cos-sky"></div></div>
  <div class="cos-layer cos-layer--map" data-layer="map">
    <div class="cos-stage"><div class="cos-continuum" aria-hidden="true"></div><div class="cos-plane" style="width:${WORLD.w}px;height:${WORLD.h}px">${renderWorldHTML(model, { base })}</div><div class="cos-map-placeholder" aria-hidden="true">${boardTile(model, WORLD)}</div></div>
  </div>
  <div class="cos-layer cos-layer--near" data-layer="near">
    <div class="cos-title">
      <span class="an-screw"></span><span class="an-screw"></span><span class="an-screw"></span><span class="an-screw"></span>
      <p class="cos-title__text" data-cos-title data-text="${escapeHtml(cfg.titleText)}" aria-hidden="true">${escapeHtml(cfg.titleText)}</p>
      <p class="cos-title__sub" data-cos-sub aria-hidden="true">${escapeHtml(subline)}</p>
      <span class="park-plate__sheen" aria-hidden="true"></span>
    </div>
  </div>
  <div class="cos-hole" aria-hidden="true"><canvas></canvas><p class="cos-hole__readout" data-cos-readout></p></div>
  <div class="cos-warp" aria-hidden="true"></div>
  <div class="cos-film an-film" aria-hidden="true"></div>
  <p class="cos-strip" data-cos-strip aria-hidden="true"></p>
  <nav class="cos-hud" aria-label="Map">
    <ol class="cos-crumbs" data-cos-crumbs><li><a href="${base}">Overview</a></li></ol>
    <div class="cos-seq" data-cos-seq hidden>
      <button type="button" data-act="prev" aria-label="Previous">←</button>
      <span class="an-lcd cos-seq__count" data-cos-count></span>
      <button type="button" data-act="next" aria-label="Next">→</button>
    </div>
    <div class="cos-actions">
      <button type="button" data-act="sound" aria-pressed="false">Sound off</button>
      <button type="button" data-act="tour" aria-pressed="false">Play tour</button>
      <button type="button" data-act="dive">Fall into the black hole</button>
    </div>
  </nav>
  ${parkMarkup(model.regions.filter((r) => r.module).map((r) => r.module), base)}
  <p class="cos-hint">Click a field to travel there; click again to open it. ← → move through slides, photos and posts. Esc goes up a level. Scroll up or pinch to go home through the singularity.</p>
  <dialog class="lightbox" aria-label="Photo">
    <form method="dialog"><button class="lightbox__close an-key">Close</button></form>
    <div class="lightbox__stage"><img class="lightbox__img" alt="" draggable="false"></div>
    <div class="lightbox__bar">
      <p class="lightbox__caption" aria-live="polite"></p>
      <div class="lightbox__nav">
        <button type="button" class="an-key" data-step="-1">Previous</button>
        <span class="an-lcd lightbox__count" aria-hidden="true"></span>
        <button type="button" class="an-key" data-step="1">Next</button>
      </div>
    </div>
    <p class="lightbox__hint" hidden>Hold the photo (or press Space) to gather it into a globe. ← → move to the next photo through the collapse.</p>
  </dialog>
  <h1 class="ill-sr">${escapeHtml(cfg.titleText)}</h1>`;
}

/**
 * @param {HTMLElement} root   element with class "cos" (and cosmosMarkup inside, or empty)
 * @param {ReturnType<import('../illusion/store.js').createIllusionStore>} store   COSMOS_CONFIG store
 * @param {{ modules: Array, shots?: Array, subline?: string, base?: string, particles?: () => Promise<any> }} options
 *   base       "/" for real paths (the site) or "#/" for fragments (single-file demos)
 *   particles  loader for the particle-globe module (photo viewer); optional
 */
export function createCosmos(root, store, { modules, shots = [], subline = '', base = '/', particles = null }) {
  const cfg = () => store.get();
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches || cfg().previewReducedMotion;

  let model = worldModel(cfg().seed, modules);
  if (!root.querySelector('.cos-plane') || Number(root.dataset.seed) !== cfg().seed) {
    root.innerHTML = cosmosMarkup(model, cfg(), subline, { base });
  }
  root.dataset.seed = cfg().seed;

  const $ = (sel) => root.querySelector(sel);
  const plane = $('.cos-plane');
  const layers = { far: $('[data-layer="far"]'), map: $('[data-layer="map"]'), near: $('[data-layer="near"]') };
  const sky = $('.cos-sky');
  const titleEl = $('[data-cos-title]');
  const subEl = $('[data-cos-sub]');
  const crumbs = $('[data-cos-crumbs]');
  const holeWrap = $('.cos-hole');
  const warpHost = $('.cos-warp');
  const readout = $('[data-cos-readout]');
  const tourBtn = $('[data-act="tour"]');
  const soundBtn = $('[data-act="sound"]');
  const strip = $('[data-cos-strip]');
  const seqBar = $('[data-cos-seq]');
  const seqCount = $('[data-cos-count]');

  const camera = createCamera(root, plane, { world: WORLD, getConfig: cfg, isReduced: reduced });
  const continuum = mountContinuum($('.cos-continuum'), model, WORLD);
  const rack = createRackFocus(
    root,
    Object.entries(LAYER_MM).map(([name, distance]) => ({ name, el: layers[name], distance })),
    cfg,
    reduced,
  );

  // --- sound and finish ---------------------------------------------------------
  const sound = createSound({ getConfig: cfg });
  const SOUND_KEY = 'cos:sound';
  function setSoundButton(on) {
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
  }
  async function toggleSound() {
    const on = !sound.isEnabled();
    if (on) await sound.enable(); else sound.disable();
    setSoundButton(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch {}
    if (on) sound.latch();
  }
  // A visitor who turned sound on last time gets it back at their first gesture
  // (browsers refuse audio before one).
  let soundArmed = false;
  try { soundArmed = localStorage.getItem(SOUND_KEY) === 'on'; } catch {}
  const armSound = async (e) => {
    if (!soundArmed || e.target.closest?.('[data-act="sound"]')) return;
    soundArmed = false;
    await sound.enable();
    setSoundButton(true);
  };
  root.addEventListener('pointerdown', armSound, true);
  root.addEventListener('keydown', armSound, true);

  let ringsReady = false;
  /** Apply the Finish and Sky settings as classes and custom properties. */
  function applyFinish(c) {
    const analog = c.finish === 'analog';
    root.classList.toggle('cos--analog', analog);
    root.classList.toggle('cos--emboss', analog && c.emboss);
    if (analog) root.dataset.type = c.typeface; else delete root.dataset.type;
    root.style.setProperty('--an-grain', String(c.grain));
    root.style.setProperty('--an-vignette', String(c.vignette));
    root.style.setProperty('--an-bezel', `${analog ? c.bezel : 0}px`);
    if (c.skyStyle === 'rings' && !ringsReady) {
      root.style.setProperty('--cos-rings', `url(${pinnaTile(900, 2)})`);
      ringsReady = true;
    }
    sky.dataset.sky = c.skyStyle;
  }
  applyFinish(cfg());

  // --- title card with a physics text effect --------------------------------
  const textCtx = { pointer: { x: 0.5, y: 0.5, clientX: null, clientY: null }, reducedMotion: reduced, attractor: null };
  let titleFx = null;
  let titleEffectId = null;
  function setTitle(text, sub = '') {
    titleFx?.destroy();
    titleEl.dataset.text = text;
    titleEl.textContent = text;
    subEl.textContent = sub;
    titleEffectId = cfg().titleEffect;
    titleFx = REGISTRY.texts[titleEffectId]?.mount(titleEl, cfg(), textCtx) ?? null;
  }

  let rackTimer = 0;
  const plates = createDestinationPlates(root, { rack, setTitle, isReduced: reduced, focusDuration: () => cfg().focusPull, shouldRack: () => cfg().rackOnArrival });
  const park = mountParkUI(root, modules, { base, navigate, isReduced: reduced });
  /** Arrival moment: new title, focus racks to it, then back to the map. */
  function announce(title, sub, route, { stay = false } = {}) {
    // Visible world width, so content in a filled field sizes itself to the screen.
    plane.style.setProperty('--cos-view-w', camera.state.w.toFixed(0));
    setCrumbs(route);
    clearTimeout(rackTimer);
    sound.thock();
    const token = plates.begin(title, sub, route);
    plates.finish(token);
  }

  function setCrumbs(route) {
    const parts = route ? route.split('/') : [];
    let html = `<li><a href="${base}" data-route="">Overview</a></li>`;
    let path = '';
    for (const p of parts) {
      path = path ? `${path}/${p}` : p;
      const el = placeEl(path);
      const name = /^\d+$/.test(p) ? `Slide ${p}` : p === 'report' ? 'Report' : el?.querySelector('h2, h3, .cos-singularity__label')?.textContent ?? p;
      html += `<li><a href="${base}${escapeHtml(path)}" data-route="${escapeHtml(path)}">${escapeHtml(name)}</a></li>`;
    }
    crumbs.innerHTML = html;
    crumbs.lastElementChild?.firstElementChild?.setAttribute('aria-current', 'location');
  }

  // --- routes -------------------------------------------------------------
  const rectOf = (el) => {
    const [x, y, w, h] = el.dataset.fly.split(',').map(Number);
    return { x, y, w, h };
  };
  // --- router: real paths on the site, fragments in single-file demos ----------
  const usePath = !base.startsWith('#');            // "/" or "/subfolder/" for the site, "#/" for single-file demos
  const routeFromHash = () => decodeURIComponent(usePath
    ? (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname).replace(/^\/+|\/+$/g, '')
    : location.hash.replace(/^#\/?/, ''));
  const urlFor = (route) => `${base}${route}`;
  /** Go somewhere: a history entry (so Back flies back), then the flight. */
  function navigate(route, { replace = false } = {}) {
    if (route !== routeFromHash()) history[replace ? 'replaceState' : 'pushState'](null, '', urlFor(route));
    director.stop();
    if (!busy) go(route);
  }
  /** The element that is the place for a route (the field, not its title link). */
  const placeEl = (route) => plane.querySelector(`[data-fly][data-route="${CSS.escape(route)}"]`)
    ?? plane.querySelector(`[data-route="${CSS.escape(route)}"]`);
  const parentOf = (route) => route.split('/').slice(0, -1).join('/');

  /** A cell's own rect in world units (content cells carry their region's rect in data-fly). */
  function cellRect(el) {
    const region = el.closest('.cos-region');
    if (!region || region === el) return rectOf(el);
    const R = rectOf(region);
    return { x: R.x + el.offsetLeft, y: R.y + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
  }

  /**
   * Where a route goes. Regions are framed (their content needs the whole
   * region); items use the Arrival setting unless `fit` overrides it.
   */
  function destination(route, fit = null) {
    if (!route || route === 'overview') {
      return { view: camera.overview(), focusPoint: null, title: cfg().titleText, sub: subline, route: '' };
    }
    const el = placeEl(route === 'about' ? 'about/studio' : route);
    if (!el) return null;
    const isContent = el.matches('.cos-cell--content');
    // Photos fill the screen; reading fields, slides, projects and cards are framed whole
    // (so a text column is never cropped off-screen).
    const fills = el.matches('.cos-kind-photo');
    const isItem = !isContent && !el.matches('.cos-region, .cos-singularity');
    const mode = fit ?? (fills ? cfg().arrivalFit : 'frame');
    const target = isContent ? (mode === 'fill' ? cellRect(el) : rectOf(el)) : rectOf(el);
    const focus = isContent ? cellRect(el) : rectOf(el);
    let view = camera.fit(target, isItem ? 0.1 : 0.06, mode);
    if (el.matches('.cos-slide')) {
      const vw = root.clientWidth, vh = root.clientHeight;
      const top = vw < 760 ? 165 : 130, bottom = 38;
      const scale = Math.min((vw - 40) / target.w, Math.max(120, vh - top - bottom) / target.h);
      view = [target.x + target.w / 2, target.y + target.h / 2 - (top - bottom) / (2 * scale), vw / scale];
    }
    return {
      view,
      focusPoint: [focus.x + focus.w / 2, focus.y + focus.h / 2],
      title: el.querySelector('h2, h3, .cos-singularity__label')?.textContent ?? route,
      sub: el.querySelector('p')?.textContent ?? '',
      route,
      el,
    };
  }

  async function go(route, { immediate = false } = {}) {
    if (route === 'singularity') {
      const d = destination(route);
      if (d) await camera.flyTo(d.view, { immediate });
      return dive();
    }
    // Home from inside the map: sucked through the singularity, not flown back across.
    if (!route && !immediate && cfg().returnHome === 'hole' && !camera.atOverview()) return warpHome();
    const d = destination(route);
    if (!d) return;
    leave();
    setCrumbs(d.route);
    const flightViewport = [root.clientWidth, root.clientHeight];
    const token = plates.begin(d.title, d.sub, d.route);
    const arrived = await camera.flyTo(d.view, { immediate });
    if (!arrived) { plates.cancel(token); return; }
    if (arrived && await plates.finish(token)) {
      // A rotation during the flight has no current reading node for the resize observer to refit.
      if (flightViewport[0] !== root.clientWidth || flightViewport[1] !== root.clientHeight) {
        const resized = destination(route);
        if (resized) await camera.flyTo(resized.view, { immediate: true });
      }
      plane.style.setProperty('--cos-view-w', camera.state.w.toFixed(0));
      sound.thock();
      arrive(d.route);
    }
  }

  // --- arriving at a place -------------------------------------------------------
  /** Before a flight: stop reading, so text doesn't reflow mid-air. */
  function leave() {
    plane.querySelectorAll('.is-reading').forEach((el) => el.classList.remove('is-reading'));
  }
  /**
   * On arrival: mark the place, assemble its compositions, open reading
   * fields at a steady on-screen type size, drop the gallery's painting,
   * and show ← → for places in a sequence.
   */
  function arrive(route) {
    plane.querySelectorAll('.is-current').forEach((el) => el.classList.remove('is-current'));
    root.classList.toggle('in-gallery', route === 'gallery' || route.startsWith('gallery/'));
    root.classList.toggle('at-home', route === '');
    root.classList.toggle('is-deep', route.split('/').length >= 2);
    root.dataset.destination = route.split('/')[0] || 'overview';
    const el = route ? placeEl(route === 'about' ? 'about/studio' : route) : null;
    if (el) {
      el.classList.add('is-current');
      el.style.setProperty('--read-s', (root.clientWidth / camera.state.w).toFixed(5));
      // A direct link can skip the outer composition's reveal trigger.
      for (let parent = el.parentElement; parent && parent !== plane; parent = parent.parentElement) {
        if (parent.matches('.stijl[data-assemble]')) parent.classList.add('is-in');
      }
      el.querySelectorAll('.stijl[data-assemble]').forEach((sec) => sec.classList.add('is-in'));
      if (el.hasAttribute('data-read')) {
        el.style.setProperty('--read-s', (root.clientWidth / camera.state.w).toFixed(5)); // type stays ~19px on screen
        el.classList.add('is-reading');
        el.querySelector('.cos-read')?.focus({ preventScroll: true });
      }
    }
    updateSeq(el);
    park.update(route);
  }
  /** Places that come in order (slides, photos, posts): their siblings and position. */
  function sequenceOf(el) {
    if (!el?.dataset.seq) return null;
    const list = [...plane.querySelectorAll(`[data-fly][data-seq="${CSS.escape(el.dataset.seq)}"]`)]
      .sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i));
    return { list, i: list.indexOf(el) };
  }
  function updateSeq(el) {
    const seq = sequenceOf(el);
    seqBar.hidden = !seq || seq.list.length < 2;
    if (seq) seqCount.textContent = `${seq.i + 1} / ${seq.list.length}`;
  }
  /** ← → : the previous or next place in the current sequence (a project's → is its first slide). */
  function step(delta) {
    const route = routeFromHash();
    const el = placeEl(route);
    if (el?.matches('.cos-kind-project') && delta > 0) return navigate(el.dataset.format === 'report' && placeEl(`${route}/report`) ? `${route}/report` : `${route}/1`);
    const seq = sequenceOf(el);
    if (!seq) return;
    const next = seq.list[(seq.i + delta + seq.list.length) % seq.list.length];
    navigate(next.dataset.route);
  }
  /** Reveal nested compositions that come into view by zooming (not only by arriving). */
  function revealVisible() {
    const vw = root.clientWidth, vh = root.clientHeight;
    plane.querySelectorAll('.stijl[data-assemble]:not(.is-in)').forEach((sec) => {
      const r = sec.getBoundingClientRect();
      if (r.width > 320 && r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh) sec.classList.add('is-in');
    });
  }

  const onHash = () => { director.stop(); if (!busy) go(routeFromHash()); };
  window.addEventListener('popstate', onHash);   // Back and Forward fly back and forth

  // --- shots: pre-planned moves (and the Ken Burns tour) -------------------
  const shotList = shots.map(normalizeShot).filter((sh) => sh.id && sh.steps.length);
  const director = createDirector({
    camera,
    resolve: (step) => (Array.isArray(step.to)
      ? { view: step.to, focusPoint: null, title: step.title ?? '', sub: '', route: null }
      : destination(step.to, step.fit)),
    arrive: (dest, step) => {
      if (dest.route == null && !step.title) return; // a bare view: no card
      const route = dest.route ?? routeFromHash();
      announce(step.title ?? dest.title, step.title ? '' : dest.sub, route, { stay: step.focus === 'near' });
      history.replaceState(null, '', urlFor(route)); // keep the URL honest
      arrive(route);
    },
    onState: (id) => {
      const on = id === 'tour';
      tourBtn.setAttribute('aria-pressed', String(on));
      tourBtn.textContent = on ? 'Stop tour' : 'Play tour';
    },
  });

  /** The built-in tour: overview, then every module, with Ken Burns holds. */
  function tourShot() {
    const c = cfg();
    return normalizeShot({
      id: 'tour',
      loop: c.tourLoop,
      steps: [
        { to: 'overview', hold: c.tourHold, push: c.tourDrift },
        ...modules.map((m) => ({ to: m.id, fit: 'frame', hold: c.tourHold, push: c.tourDrift })),
      ],
    });
  }
  const findShot = (id) => shotList.find((sh) => sh.id === id) ?? (id === 'tour' ? tourShot() : null);
  let idleShotPlaying = false;
  /** Play a shot by id. Returns false if there is no such shot. */
  function play(id, { fromIdle = false } = {}) {
    const shot = findShot(id);
    if (!shot || busy) return false;
    idleShotPlaying = fromIdle;
    director.play(shot);
    return true;
  }

  // --- the black hole (ray traced) -------------------------------------------
  let hole = null;
  let holeTried = false;
  let skyDirty = true;
  let busy = false;          // a fall or warp is running
  let skipLinger = false;
  const holeState = { yaw: 0, time: 0 };

  /** Paint the main page into the part of the sky the camera sees, tiled around. */
  function paintSkyFromWorld() {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    const aspect = root.clientWidth / Math.max(1, root.clientHeight);
    const vfov = 55;
    const hfov = (2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * aspect) * 180) / Math.PI;
    const tw = (c.width * hfov) / 360;
    const th = (c.height * vfov) / 180;
    const tile = document.createElement('canvas');
    tile.width = Math.round(tw); tile.height = Math.round(th);
    const [ox, oy, ow] = camera.overview();
    const oh = ow * (root.clientHeight / Math.max(1, root.clientWidth));
    paintLeaves(tile.getContext('2d'), worldLeaves(model), { x: ox - ow / 2, y: oy - oh / 2, w: ow, h: oh });
    for (let i = -4; i <= 4; i++) for (let j = -2; j <= 2; j++) {
      ctx.drawImage(tile, c.width / 2 - tw / 2 + i * tw, c.height / 2 - th / 2 + j * th, tw, th);
    }
    return c;
  }

  function ensureHole() {
    if (!holeTried) {
      holeTried = true;
      hole = createBlackHole(holeWrap.querySelector('canvas'));
      if (!hole) holeWrap.classList.add('is-fallback');
    }
    if (hole && skyDirty) { hole.setSky(paintSkyFromWorld()); skyDirty = false; }
    return hole;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Animate `fn(t, dt)` for t in 0→1 over `seconds` on the main loop. */
  function animate(seconds, fn, { until } = {}) {
    return new Promise((resolve) => {
      let t = 0;
      frameJobs.add(function job(dt) {
        t += dt / 1000 / seconds;
        fn(Math.min(1, t), dt);
        if (t >= 1 || until?.()) { frameJobs.delete(job); resolve(); }
      });
    });
  }

  function holeFrame(dist, dt, yawRate) {
    const c = cfg();
    holeState.yaw += (yawRate * dt) / 1000;
    holeState.time += dt / 1000;
    hole.resize(c.bhQuality);
    hole.set({
      dist, incl: c.bhInclination + (0.5 - textCtx.pointer.y) * 6, yaw: holeState.yaw, time: holeState.time,
      disk: c.bhDisk, beaming: c.bhBeaming, palette: c.bhPalette,
    });
    hole.render();
    const r = root.getBoundingClientRect();
    textCtx.attractor = { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: hole.screenShadowRadius() };
    readout.innerHTML =
      `<span>${dist.toFixed(dist < 3 ? 2 : 1)} rₛ from the centre</span>` +
      `<span>A clock held still here runs at ${(timeDilation(dist) * 100).toFixed(1)}% speed</span>`;
  }

  /** The cinematic route: approach and orbit the ray-traced hole, then get sucked in. */
  async function dive() {
    if (busy) return;
    busy = true;
    skipLinger = false;
    director.stop();
    camera.cancel();
    clearTimeout(rackTimer);
    plates.cancel();
    const c = cfg();
    const h = ensureHole();
    if (!h || reduced()) { busy = false; return warpHome(); }

    root.classList.add('is-diving');
    root.classList.remove('is-receded');
    setTitle('Singularity', 'Click or scroll to fall in');
    setCrumbs('singularity');
    rack.focusOn('map');
    // Approach from far enough that the lensing is faint: the view still reads as the map.
    await animate(1.8, (t, dt) => holeFrame(60 + (c.bhDistance - 60) * (1 - (1 - t) ** 3), dt, c.bhOrbit));
    if (cfg().holeLinger > 0) {
      root.classList.add('is-lingering');
      await animate(cfg().holeLinger, (t, dt) => holeFrame(cfg().bhDistance, dt, cfg().bhOrbit), { until: () => skipLinger });
      root.classList.remove('is-lingering');
    }
    // Hand the last ray-traced frame to the warp: the warp starts from exactly this picture.
    holeFrame(cfg().bhDistance, 16, cfg().bhOrbit);
    const box = root.getBoundingClientRect();
    const snap = document.createElement('canvas');
    snap.width = Math.round(box.width); snap.height = Math.round(box.height);
    snap.getContext('2d').drawImage(holeWrap.querySelector('canvas'), 0, 0, snap.width, snap.height);
    const horizon0 = h.screenShadowRadius() / (box.height / 2);
    busy = false;
    await warpHome({ from: snap, horizon0, afterStart: () => root.classList.remove('is-diving') });
  }

  // --- the warp home (three.js) ------------------------------------------------
  let warp = null;
  let warpTried = false;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /**
   * Suck whatever is on screen into the singularity, curl the site into a
   * sphere, drop it, zoom into it, land on the main page.
   */
  async function warpHome({ from = null, horizon0 = 0, afterStart, manual = false } = {}) {
    if (busy) return;
    busy = true;
    director.stop();
    camera.cancel();
    clearTimeout(rackTimer);
    plates.cancel();
    pressure = 0;
    const c = cfg();
    const landHome = () => {
      if (routeFromHash()) history.pushState(null, '', urlFor('')); // back button returns to where you were
      arrive('');
      announce(c.titleText, subline, '');
    };

    if (!warpTried) { warpTried = true; warp = createWarp(warpHost); }
    if (!warp || reduced()) {
      // Reduced motion or no WebGL: a quick fade through ink.
      root.classList.add('is-passing-cut');
      await wait(reduced() ? 120 : 280);
      camera.flyTo(camera.overview(), { immediate: true });
      landHome();
      root.classList.remove('is-passing-cut', 'is-diving');
      busy = false;
      return;
    }

    const snap = from ?? snapshotCosmos(root);
    root.classList.add('is-warping');
    await nextFrame();
    afterStart?.();
    await warp.play(snap, {
      speed: c.warpSpeed,
      backdrop: c.warpBackdrop,
      swirl: c.warpSwirl,
      streaks: c.warpStreaks,
      sphereSize: c.sphereSize,
      drop: c.sphereDrop,
      horizon0,
      manual,
      onPhase: (phase) => {
        root.dataset.warpPhase = phase; // CSS / test hook: suck | curl | drop | zoom | done
        const sp = c.warpSpeed;         // act lengths match warp.js: 1.5, 1.2, 1.15 s at speed 1
        if (phase === 'suck') { if (c.soundFall) sound.fall((1.5 + 1.2) / sp); sound.rumble(1.5 / sp); }
        if (phase === 'curl') sound.spin(1.2 / sp);
        if (phase === 'zoom') sound.rush(1.15 / sp);
        if (phase === 'done') sound.land();
      },
      onBounce: (v) => sound.bounce(v),
      // While the sphere is a few pixels across: move home and photograph it (no title card yet).
      home: async () => {
        textCtx.attractor = null;
        camera.flyTo(camera.overview(), { immediate: true });
        root.classList.remove('has-title', 'is-receded');
        rack.focusOn('map');
        setCrumbs('');
        await nextFrame();
        return snapshotCosmos(root, { card: false });
      },
    });
    root.classList.remove('is-warping');
    landHome(); // the title card arrives after landing, with its rack focus
    busy = false;
  }

  // --- input ------------------------------------------------------------------
  const pointers = new Map();
  let dragMoved = false;
  let lastMove = 0;
  let pinchDist = 0;
  let readerDrag = null;     // the text being scrolled by a drag, if any
  let pressure = 0;          // 0–1: how close a back gesture is to triggering
  let keyboardNav = false;
  let lastInput = performance.now();

  /** Any deliberate input: stops shots (the camera glides to rest) and resets idle. */
  function interrupt() {
    lastInput = performance.now();
    if (director.playing()) { director.stop(); camera.stop(); }
  }

  const isChrome = (el) => el.closest('.cos-hud, .ill-admin, .cos-title, .park-ui, dialog');

  /** At the main page: keep pushing back and take the cinematic fall. */
  function pushAtEdge(amount) {
    if (!cfg().boundless || busy) return;
    pressure += amount / PUSH_THRESHOLD;
    if (pressure >= 1) { pressure = 0; dive(); }
  }
  /** Inside the map: the painting yields, then it all gets sucked home. */
  function pushHome(amount) {
    if (busy) return;
    pressure += amount / HOME_THRESHOLD;
    if (pressure >= 1) { pressure = 0; warpHome(); }
  }
  /** Route a back gesture of a given strength. */
  function back(amount, zoomOut) {
    if (camera.atOverview()) pushAtEdge(amount);
    else if (cfg().returnHome === 'hole') pushHome(amount);
    else zoomOut();
  }

  root.addEventListener('wheel', (e) => {
    if (e.target.closest('.ill-admin, .park-ui, dialog')) return;
    e.preventDefault();
    if (busy) { skipLinger = true; return; }
    interrupt();
    const r = root.getBoundingClientRect();
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    // Reading: the wheel scrolls the text (at screen speed) until it runs out.
    const reader = e.target.closest('.is-reading .cos-read, .is-current [data-park-scroll]');
    if (reader) {
      const canDown = reader.scrollTop + reader.clientHeight < reader.scrollHeight - 1;
      const canUp = reader.scrollTop > 0;
      if ((dy > 0 && canDown) || (dy < 0 && canUp)) { reader.scrollTop += dy * (camera.state.w / root.clientWidth); return; }
    }
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const isBack = cfg().backGesture === 'up' ? dy < 0 : dy > 0;
    const mag = Math.abs(dy);
    if (isBack) back(mag, () => camera.wheel(sx, sy, mag));
    else camera.wheel(sx, sy, -mag); // the other direction zooms in, about the cursor
  }, { passive: false });

  root.addEventListener('pointerdown', (e) => {
    if (isChrome(e.target) || busy) { if (busy) skipLinger = true; return; }
    interrupt();
    readerDrag = e.target.closest('.is-reading .cos-read, .is-current [data-park-scroll]');
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    lastMove = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  window.addEventListener('pointermove', (e) => {
    textCtx.pointer.clientX = e.clientX;
    textCtx.pointer.clientY = e.clientY;
    const rr = root.getBoundingClientRect();
    textCtx.pointer.x = (e.clientX - rr.left) / rr.width;
    textCtx.pointer.y = (e.clientY - rr.top) / rr.height;
    lastInput = performance.now();
    if (idleShotPlaying && director.playing()) { director.stop(); camera.stop(); } // attract mode ends on movement

    const p = pointers.get(e.pointerId);
    if (!p) return;
    const now = performance.now();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;

    if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) {
        const factor = pinchDist / d; // > 1: fingers together = back
        const mx = (a.x + b.x) / 2 - rr.left, my = (a.y + b.y) / 2 - rr.top;
        if (factor > 1) back((factor - 1) * 2200, () => camera.pinch(mx, my, factor));
        else camera.pinch(mx, my, factor);
      }
      pinchDist = d;
      dragMoved = true;
      return;
    }
    if (!dragMoved && Math.hypot(dx, dy) < 6) return;
    if (readerDrag && pointers.size === 1) {
      // Dragging inside the text scrolls it (touch reading), at screen speed.
      readerDrag.scrollTop -= dy * (camera.state.w / root.clientWidth);
      p.x = e.clientX; p.y = e.clientY; dragMoved = true;
      return;
    }
    if (!dragMoved) { dragMoved = true; camera.dragStart(); root.setPointerCapture?.(e.pointerId); }
    camera.dragBy(dx, dy, now - lastMove);
    p.x = e.clientX; p.y = e.clientY;
    lastMove = now;
  });

  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) camera.dragEnd();
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  /**
   * Clicks: zoom one level deeper than the current view (region, then field),
   * never straight to the tiniest thing. A shot bound to the clicked route,
   * or a data-shot attribute, plays instead.
   */
  root.addEventListener('click', (e) => {
    if (isChrome(e.target)) return;
    // Ordinary links inside the place you're at (API endpoints, links in a post) just work.
    const plainLink = e.target.closest('a[href]:not([data-route])');
    if (plainLink && plainLink.closest('.is-current')) return;
    if (e.detail === 0) {
      // Keyboard activation of a map link: travel there.
      const a = e.target.closest('a[data-route]');
      if (a) { e.preventDefault(); navigate(a.dataset.route); }
      return;
    }
    e.preventDefault();
    if (dragMoved || busy) return;
    // Clicking again where you are: a photo opens in the viewer; a project starts presenting.
    const here = e.target.closest('.is-current');
    if (here?.matches('.cos-kind-photo')) { openPhoto(here); return; }
    if (here?.matches('.cos-kind-project') && !e.target.closest('.cos-slide, .cos-nested')) {
      // Clicking the project's own margin opens it the way it was written: a report reads, a presentation presents.
      step(1);
      return;
    }
    if (e.target.closest('.is-reading .cos-read, .is-current [data-park-scroll]')) return;
    const shotEl = e.target.closest('[data-shot]');
    if (shotEl && play(shotEl.dataset.shot)) return;
    // One level deeper than where you are: the outermost field under the click that is smaller
    // than the view, ignoring the place you're already at and everything around it.
    const current = plane.querySelector('.is-current');
    const chain = [];
    for (let el = e.target.closest('[data-fly]'); el && root.contains(el); el = el.parentElement?.closest('[data-fly]')) {
      if (current && (el === current || el.contains(current))) break;
      chain.push(el);
    }
    const camW = camera.state.w;
    const pick = [...chain].reverse().find((el) => rectOf(el).w < camW * 0.7) ?? chain[0];
    if (!pick) {
      const bounds = root.getBoundingClientRect();
      const [x, y] = camera.toWorld(e.clientX - bounds.left, e.clientY - bounds.top);
      const repeated = repeatedDestination(model, x, y, WORLD);
      if (repeated) navigate(repeated);
      return;
    }
    const route = pick.dataset.route ?? pick.dataset.routeRegion;
    if (route) {
      const bound = shotList.find((sh) => sh.trigger.on === 'click' && sh.trigger.route === route);
      if (bound) {
        if (routeFromHash() !== route) history.pushState(null, '', urlFor(route));
        play(bound.id);
      } else navigate(route);
    } else {
      // A plain colour field: track to it until it fills the screen (or frame it).
      camera.flyTo(camera.fit(rectOf(pick), 0.1, cfg().arrivalFit));
    }
  });
  // data-shot anywhere on the page (site nav, CMS buttons) plays that shot.
  const onDocClick = (e) => {
    const el = e.target.closest?.('[data-shot]');
    if (!el || root.contains(el)) return;
    if (play(el.dataset.shot)) e.preventDefault();
  };
  document.addEventListener('click', onDocClick);

  // Keyboard: Tab through the map and the camera follows focus.
  // Keys work anywhere on the page, except while typing, in the photo viewer, or in the control panel.
  const onKeyDown = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable], .ill-admin, dialog[open]')) return;
    keyboardNav = true;
    if (busy) { skipLinger = true; return; }
    interrupt();
    const k = e.key;
    if ((k === 'V' || k === 'v') && e.altKey && e.shiftKey) {
      // Authoring aid: copy the current view for a shot step.
      const { x, y, w } = camera.state;
      const view = `[${Math.round(x)}, ${Math.round(y)}, ${Math.round(w)}]`;
      navigator.clipboard?.writeText(view);
      console.info('[cosmos] view copied:', view);
      return;
    }
    if (k === 'Escape') { const r = routeFromHash(); navigate(r ? parentOf(r) : ''); }
    else if ((k === 'ArrowRight' || k === 'ArrowLeft') && (seqBar.hidden === false || placeEl(routeFromHash())?.matches('.cos-kind-project'))) {
      e.preventDefault();
      step(k === 'ArrowRight' ? 1 : -1);
      return;
    }
    else if (e.target.closest('.is-reading .cos-read, .is-current [data-park-scroll]') && /^(Arrow(Up|Down)|PageUp|PageDown|Home|End| )$/.test(k)) return;
    else if (k === '+' || k === '=') camera.wheel(root.clientWidth / 2, root.clientHeight / 2, -300);
    else if (k === '-' || k === '_') back(HOME_THRESHOLD, () => camera.wheel(root.clientWidth / 2, root.clientHeight / 2, 300));
    else if (k.startsWith('Arrow') && !e.target.closest('input, select, textarea')) {
      e.preventDefault();
      camera.nudge(k === 'ArrowLeft' ? -0.3 : k === 'ArrowRight' ? 0.3 : 0, k === 'ArrowUp' ? -0.3 : k === 'ArrowDown' ? 0.3 : 0);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  root.addEventListener('pointerdown', () => { keyboardNav = false; }, true);
  root.addEventListener('focusin', (e) => {
    const el = e.target.closest('a[data-route]');
    if (!keyboardNav || !el || !plane.contains(el) || el.dataset.route === 'singularity') return;
    director.stop();
    const d = destination(el.dataset.route);
    if (!d) return;
    leave();
    camera.flyTo(d.view).then((ok) => { if (ok) { announce(d.title, d.sub, d.route); arrive(d.route); } });
  });

  // HUD buttons; hovering the title card pulls focus to it.
  root.querySelector('.cos-hud').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'sound') { toggleSound(); return; }
    if (act) (act === 'tour' ? sound.latch : sound.key)();
    if (act === 'tour') {
      if (director.playing() === 'tour') { director.stop(); camera.stop(); }
      else play('tour');
    }
    if (act === 'dive') dive();
    if (act === 'prev') step(-1);
    if (act === 'next') step(1);
  });
  crumbs.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-route]');
    if (!a) return;
    e.preventDefault();      // stay in the world: fly there instead of loading a page
    sound.key();
    navigate(a.dataset.route);
  });

  // --- config changes -----------------------------------------------------
  const unsubscribe = store.subscribe((next, prev) => {
    if (next.seed !== prev.seed && modules.every((m) => m.items.every((i) => i.kind))) {  // the live site ships a light copy; rebuilding needs full content (dev)
      model = worldModel(next.seed, modules);
      plane.innerHTML = renderWorldHTML(model, { base });
      continuum.updateModel(model);
      prepareNested();
      root.dataset.seed = next.seed;
      skyDirty = true;
      camera.flyTo(camera.overview(), { immediate: true });
      announce(next.titleText, subline, '');
    } else if (next.seed !== prev.seed) {
      /* light modules: no rebuild */
    } else if (next.titleEffect !== titleEffectId || (next.titleText !== prev.titleText && !routeFromHash())) {
      setTitle(routeFromHash() ? titleEl.dataset.text : next.titleText, subEl.textContent);
    } else {
      titleFx?.update(next);
    }
    root.classList.toggle('is-reduced-motion', reduced());
    root.classList.toggle('cos--fill', next.arrivalFit === 'fill');
    applyFinish(next);
    if (next.soundVolume !== prev.soundVolume) sound.setVolume();
    if (next.soundAmbient !== prev.soundAmbient && sound.isEnabled()) sound.ambient(next.soundAmbient);
  });

  // --- main loop ----------------------------------------------------------
  const frameJobs = new Set();
  let raf = 0, last = 0;
  let lastDetent = Math.log(rack.focusDistance());
  let wasMoving = false;
  let stripText = '';
  let weaving = false;
  function frame(now) {
    const dt = Math.min(100, last ? now - last : 16);
    last = now;
    camera.tick(dt);
    rack.tick(dt);
    titleFx?.tick?.(dt);
    frameJobs.forEach((job) => job(dt));
    pressure *= Math.exp(-dt / 600); // the painting springs back if you stop pushing
    root.style.setProperty('--cos-pressure', Math.min(1, pressure).toFixed(3));
    // Sky parallax: far things move less (1/distance); a slight scale with zoom
    // is what makes the Pinna rings appear to turn.
    const s = camera.state;
    continuum.update(s, { w: root.clientWidth, h: root.clientHeight });
    const zoomX = camera.overview()[2] / s.w;
    sky.style.transform = `translate(${(-s.x * 0.012).toFixed(1)}px, ${(-s.y * 0.012).toFixed(1)}px) scale(${Math.pow(zoomX, 0.12).toFixed(4)})`;

    // Sound: air rush follows camera speed; the focus ring clicks through detents.
    const v = camera.velocity;
    const speed = Math.min(1, (Math.hypot(v.x, v.y) / s.w) * 0.5 + Math.abs(v.lw) * 0.6);
    sound.motion(busy ? 0 : speed);
    const lf = Math.log(rack.focusDistance());
    if (Math.abs(lf - lastDetent) > 0.09) { sound.detent(); lastDetent = lf; }

    // Analog: lens data strip and gate weave.
    const c = cfg();
    if (c.finish === 'analog') {
      const text = `<span>${c.lensFocal} mm</span><span>ƒ/${c.lensAperture.toFixed(1)}</span>` +
        `<span>focus ${(rack.focusDistance() / 1000).toFixed(1)} m</span><span>${zoomX.toFixed(1)}×</span>`;
      if (text !== stripText) { strip.innerHTML = text; stripText = text; }
      if (c.weave && !reduced()) {
        const t = now / 1000;
        const a = 0.25 + 1.1 * speed; // px: a projector gate shivers more when the film moves
        root.style.setProperty('--an-wx', `${(a * (Math.sin(t * 13.1) + Math.sin(t * 7.7 + 1.3)) / 2).toFixed(2)}px`);
        root.style.setProperty('--an-wy', `${(a * (Math.sin(t * 11.3 + 0.7) + Math.sin(t * 5.9 + 2.1)) / 2).toFixed(2)}px`);
        weaving = true;
      } else if (weaving) { root.style.setProperty('--an-wx', '0px'); root.style.setProperty('--an-wy', '0px'); weaving = false; }
    }
    // Nested compositions assemble when you come to rest over them.
    const moving = camera.isBusy();
    if (wasMoving && !moving) revealVisible();
    wasMoving = moving;
    // Idle shots (attract mode).
    if (!director.playing() && !busy) {
      const idle = shotList.find((sh) => sh.trigger.on === 'idle' && now - lastInput > sh.trigger.seconds * 1000);
      if (idle) { lastInput = now; play(idle.id, { fromIdle: true }); }
    }
    raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => {
    camera.resize(); skyDirty = true; warp?.resize();
    root.classList.toggle('is-narrow', root.clientWidth < 760);
    const route = routeFromHash(), current = plane.querySelector('.is-current');
    if (route && current && !busy && !camera.isBusy()) {
      const d = destination(route);
      if (d) { camera.flyTo(d.view, { immediate: true }); current.style.setProperty('--read-s', (root.clientWidth / camera.state.w).toFixed(5)); }
    }
  });
  ro.observe(root);

  // --- nested compositions and the photo viewer --------------------------------
  /** Nested sections start hidden and assemble on arrival (unless motion is reduced). */
  function prepareNested() {
    if (reduced()) return;
    plane.querySelectorAll('.stijl').forEach((sec) => sec.setAttribute('data-assemble', ''));
  }
  prepareNested();
  const photoEls = () => [...plane.querySelectorAll('.cos-kind-photo')].sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i));
  const lightbox = photoEls().length
    ? mountLightbox(root, {
      particles,
      photos: photoEls().map((el) => {
        const img = el.querySelector('img');
        return { src: el.dataset.photo, alt: img.alt, caption: img.alt };
      }),
    })
    : null;
  function openPhoto(el) { sound.key(); lightbox?.open(photoEls().indexOf(el)); }

  // --- start --------------------------------------------------------------
  camera.resize();
  camera.flyTo(camera.overview(), { immediate: true });
  const startRoute = routeFromHash();
  if (startRoute && startRoute !== 'singularity' && placeEl(startRoute)) go(startRoute, { immediate: true });
  else { announce(cfg().titleText, subline, ''); arrive(''); }
  const loadShot = shotList.find((sh) => sh.trigger.on === 'load');
  if (!startRoute && (loadShot || cfg().tourAutoplay)) setTimeout(() => play(loadShot ? loadShot.id : 'tour'), 2600);
  root.classList.toggle('is-reduced-motion', reduced());
  root.classList.toggle('cos--fill', cfg().arrivalFit === 'fill');
  raf = requestAnimationFrame(frame);

  return {
    camera,
    rack,
    director,
    go,
    dive,
    /** The trip home through the singularity. */
    warpHome,
    /** Play an authored shot (or 'tour') by id. */
    play,
    /** Advance a warp started with warpHome({ manual: true }) by n frames (capture/testing). */
    warpStep: (n = 1) => warp?.step(n),
    /** Current view as [x, y, w], for authoring shot steps. */
    currentView: () => [camera.state.x, camera.state.y, camera.state.w].map(Math.round),
    destroy() {
      cancelAnimationFrame(raf);
      unsubscribe();
      ro.disconnect();
      director.stop();
      plates.destroy();
      park.destroy();
      titleFx?.destroy();
      hole?.destroy();
      warp?.destroy();
      sound.destroy();
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('popstate', onHash);
      window.removeEventListener('keydown', onKeyDown);
      lightbox?.destroy();
      window.removeEventListener('pointerup', endPointer);
      window.removeEventListener('pointercancel', endPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
