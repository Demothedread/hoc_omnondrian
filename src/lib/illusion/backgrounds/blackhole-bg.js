/**
 * backgrounds/blackhole-bg.js — "Black hole" background for the illusion stage
 * ---------------------------------------------------------------------------
 * Wraps the GPU ray tracer (cosmos/blackhole.js) as a stage module. The sky
 * it bends is a Mondrian composition from the same seed as the page, so the
 * lensing reads as the painting itself being pulled around the hole.
 *
 * It also publishes ctx.attractor (screen position + shadow radius), which
 * the "Tidal letters" headline effect uses as its mass.
 *
 * Fallback: no WebGL → a static CSS shadow and photon ring (still themed).
 */
import { createBlackHole } from '../../cosmos/blackhole.js';
import { paintSky } from '../../cosmos/mondrian.js';

export const blackholeBackground = {
  id: 'blackhole',

  mount(host, cfg, ctx) {
    const root = document.createElement('div');
    root.className = 'ill-hole';
    root.innerHTML = '<canvas class="ill-hole__canvas"></canvas>';
    host.append(root);
    const canvas = root.firstElementChild;
    const hole = createBlackHole(canvas);
    if (!hole) root.classList.add('is-fallback');

    let current = null;
    let yaw = 0;
    let clock = 0;
    let skySeed = null;
    let dirty = true;

    function update(next) {
      current = next;
      if (!hole) return;
      if (next.seed !== skySeed) { hole.setSky(paintSky(next.seed)); skySeed = next.seed; }
      hole.set({ dist: next.bhDistance, incl: next.bhInclination, disk: next.bhDisk, beaming: next.bhBeaming, palette: next.bhPalette });
      hole.resize(next.bhQuality);
      dirty = true;
    }
    update(cfg);

    const ro = new ResizeObserver(() => { if (hole) { hole.resize(current.bhQuality); dirty = true; } });
    ro.observe(root);

    return {
      update,
      tick(dt) {
        const r = root.getBoundingClientRect();
        ctx.attractor = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          radius: hole ? hole.screenShadowRadius() : Math.min(r.width, r.height) * 0.12,
        };
        if (!hole) return;
        const still = ctx.reducedMotion();
        if (!still && current.bhOrbit > 0) { yaw += (current.bhOrbit * dt) / 1000; dirty = true; }
        if (!still) { clock += dt / 1000; dirty = dirty || current.bhDisk; }
        // Pointer tilts the view a few degrees: a hand-held telescope.
        const tilt = still ? 0 : (0.5 - ctx.pointer.y) * 8;
        if (dirty) {
          hole.set({ yaw, time: clock, incl: current.bhInclination + tilt });
          hole.render();
          dirty = false;
        }
      },
      destroy() {
        ro.disconnect();
        ctx.attractor = null;
        hole?.destroy();
        root.remove();
      },
    };
  },
};
