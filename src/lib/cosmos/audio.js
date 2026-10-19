/**
 * cosmos/audio.js — analog sound, synthesized (no audio files)
 * ---------------------------------------------------------------------------
 * Everything is built from oscillators, noise and filters at play time, then
 * passed through a "tape" stage (soft saturation + gentle low-pass) so it
 * sits together like one machine.
 *
 *   key()       mechanical key: noise tick through a resonant band + body thump
 *   latch()     key that locks down (two clicks, spring between)
 *   detent()    focus-ring detent, one per notch while the rack focus turns
 *   thock()     title plaque landing: a felt mallet on wood
 *   motion(s)   continuous air rush; s = camera speed 0–1, set every frame
 *   fall(sec)   Shepard–Risset glissando: a tone that falls forever without
 *               getting lower. An auditory illusion for being sucked in.
 *   rumble(sec) sub-bass swell under the fall
 *   spin(sec)   rising whine as the sphere spins up (ω ∝ 1/R²)
 *   bounce(v)   the sphere hitting the floor, louder for harder impacts
 *   rush(sec)   rising rush as we zoom into the point
 *   land()      soft thud and paper rustle on arrival home
 *   ambient(on) room tone with vinyl crackle (a Poisson process of clicks)
 *
 * Browsers only start audio after a user gesture: call enable() from a click.
 * Pass { context } (e.g. an OfflineAudioContext) to render without speakers.
 */

/**
 * @param {{ getConfig: () => object, context?: BaseAudioContext }} o
 *        config keys used: soundVolume (0–1), soundAmbient (bool)
 */
export function createSound({ getConfig, context = null }) {
  let ctx = context;
  let out = null;          // master input
  let noise = null;        // shared 2 s white-noise buffer
  let enabled = !!context; // an injected (offline) context is always on
  let air = null;          // continuous motion voice
  let room = null;         // ambient voice
  let crackleTimer = 0;

  function build() {
    if (out) return true;
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
    }
    // Tape stage: soft clip (tanh curve) → 9 kHz low-pass → speakers.
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
    shaper.curve = curve;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 9000;               // OPTION: 5000 for a darker, older machine
    out = ctx.createGain();
    out.gain.value = volume();
    out.connect(shaper).connect(tone).connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  const volume = () => Math.max(0, Math.min(1, getConfig().soundVolume ?? 0.6)) * 0.8;
  const now = () => ctx.currentTime;

  function noiseSource(loop = false) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = loop;
    return s;
  }

  /** Gain envelope: attack then exponential decay. */
  function env(param, t, peak, attack, decay) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** A short filtered noise burst. */
  function burst({ t = now(), freq = 2400, q = 3, type = 'bandpass', peak = 0.3, attack = 0.001, decay = 0.02 }) {
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t, peak, attack, decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  /** A pitched blip with a falling pitch (thumps, thocks). */
  function blip({ t = now(), from = 180, to = 90, type = 'sine', peak = 0.3, attack = 0.002, decay = 0.08 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + decay);
    const g = ctx.createGain();
    env(g.gain, t, peak, attack, decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  const ready = () => enabled && build();

  const api = {
    /** Turn sound on (call from a click: browsers require a gesture). */
    async enable() {
      enabled = true;
      if (!build()) return false;
      if (!context && ctx.state === 'suspended') await ctx.resume?.(); // live contexts only
      out.gain.setTargetAtTime(volume(), now(), 0.05);
      api.ambient(getConfig().soundAmbient !== false);
      return true;
    },
    disable() {
      enabled = false;
      if (!out) return;
      api.ambient(false);
      api.motion(0);
      out.gain.setTargetAtTime(0, now(), 0.05);
    },
    isEnabled: () => enabled,
    setVolume() { if (out) out.gain.setTargetAtTime(enabled ? volume() : 0, now(), 0.05); },

    key() {
      if (!ready()) return;
      const t = now();
      burst({ t, freq: 2600, q: 4, peak: 0.35, decay: 0.012 });
      blip({ t, from: 210, to: 120, peak: 0.22, decay: 0.045 });
    },
    latch() {
      if (!ready()) return;
      const t = now();
      api.key();
      burst({ t: t + 0.035, freq: 3400, q: 6, peak: 0.18, decay: 0.01 });  // the catch engaging
      blip({ t: t + 0.03, from: 900, to: 700, type: 'triangle', peak: 0.04, decay: 0.12 }); // spring ring
    },
    detent() {
      if (!ready()) return;
      burst({ freq: 4200, q: 1.2, type: 'highpass', peak: 0.08, decay: 0.006 });
    },
    thock() {
      if (!ready()) return;
      const t = now();
      blip({ t, from: 520, to: 380, type: 'triangle', peak: 0.16, attack: 0.004, decay: 0.14 });
      blip({ t, from: 130, to: 80, peak: 0.18, attack: 0.004, decay: 0.12 });
      burst({ t, freq: 900, q: 0.8, peak: 0.08, decay: 0.03 });
    },

    /** Continuous air rush; call every frame with camera speed 0–1. */
    motion(speed) {
      if (!out) return;
      if (!air && enabled) {
        const src = noiseSource(true);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = 300;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(out);
        src.start();
        air = { src, f, g };
      }
      if (!air) return;
      const s = enabled ? Math.max(0, Math.min(1, speed)) : 0;
      const t = now();
      air.f.frequency.setTargetAtTime(220 + 2600 * s * s, t, 0.08);
      air.g.gain.setTargetAtTime(0.32 * s, t, 0.08);
    },

    /**
     * Shepard–Risset glissando, falling. Eight octave-spaced sines all glide
     * down together; each fades in at the top and out at the bottom under a
     * bell-shaped loudness curve, so the whole sounds like it falls forever.
     */
    fall(seconds, { rate = 0.6 } = {}) {
      if (!ready()) return;
      const t0 = now();
      const N = 8;               // octaves spanned
      const base = 40;           // Hz at the bottom of the span
      const steps = Math.max(2, Math.round(seconds * 60));
      const master = ctx.createGain();
      env(master.gain, t0, 0.22, 0.25, seconds);
      master.connect(out);
      for (let k = 0; k < N; k++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const freqs = new Float32Array(steps);
        const gains = new Float32Array(steps);
        for (let i = 0; i < steps; i++) {
          const time = (i / (steps - 1)) * seconds;
          const pos = (((k - rate * time) % N) + N) % N;          // octave position, falling, wrapping
          freqs[i] = base * Math.pow(2, pos);
          gains[i] = Math.exp(-Math.pow((pos - N / 2) / (N / 5), 2)) * 0.5; // bell: silent at the wrap
        }
        o.frequency.setValueCurveAtTime(freqs, t0, seconds);
        g.gain.setValueCurveAtTime(gains, t0, seconds);
        o.connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + seconds + 0.1);
      }
    },
    rumble(seconds) {
      if (!ready()) return;
      const t = now();
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(52, t);
      o.frequency.exponentialRampToValueAtTime(30, t + seconds);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + seconds * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + seconds + 0.05);
      burst({ t, freq: 110, q: 0.5, type: 'lowpass', peak: 0.25, attack: seconds * 0.6, decay: seconds * 0.4 });
    },
    spin(seconds) {
      if (!ready()) return;
      const t = now();
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(1600, t + seconds); // spins up as it shrinks
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1800; f.Q.value = 6;
      const g = ctx.createGain();
      env(g.gain, t, 0.05, seconds * 0.7, seconds * 0.5);
      o.connect(f).connect(g).connect(out);
      o.start(t); o.stop(t + seconds * 1.3);
    },
    /** Impact speed in screen half-heights per second (≈ 0–6). */
    bounce(v) {
      if (!ready()) return;
      const k = Math.min(1, v / 4);
      blip({ from: 300 + 200 * k, to: 140, type: 'triangle', peak: 0.06 + 0.24 * k, decay: 0.07 });
      burst({ freq: 3000, q: 2, peak: 0.05 + 0.12 * k, decay: 0.008 });
    },
    rush(seconds) {
      if (!ready()) return;
      const t = now();
      const src = noiseSource();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(160, t);
      f.frequency.exponentialRampToValueAtTime(6000, t + seconds);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + seconds * 0.92);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.08);
      src.connect(f).connect(g).connect(out);
      src.start(t); src.stop(t + seconds + 0.15);
    },
    land() {
      if (!ready()) return;
      const t = now();
      blip({ t, from: 90, to: 45, peak: 0.45, attack: 0.003, decay: 0.3 });
      burst({ t: t + 0.01, freq: 1800, q: 0.7, peak: 0.12, attack: 0.01, decay: 0.25 }); // paper settling
    },

    /** Room tone plus vinyl crackle (random clicks, Poisson-timed). */
    ambient(on) {
      if (!out) return;
      if (on && enabled && !room) {
        const src = noiseSource(true);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.025, now(), 0.6);
        src.connect(f).connect(g).connect(out);
        src.start();
        room = { src, g };
        const crackle = () => {
          if (!room) return;
          if (Math.random() < 0.7) burst({ freq: 2500 + Math.random() * 4000, q: 0.8, type: 'highpass', peak: 0.01 + Math.random() * 0.04, decay: 0.002 + Math.random() * 0.004 });
          crackleTimer = setTimeout(crackle, -Math.log(1 - Math.random()) * 350); // exponential gaps = Poisson process
        };
        crackle();
      } else if (!on && room) {
        const r = room; room = null;
        clearTimeout(crackleTimer);
        r.g.gain.setTargetAtTime(0.0001, now(), 0.2);
        r.src.stop(now() + 1);
      }
    },
    destroy() {
      api.ambient(false);
      air?.src.stop();
      air = null;
      if (!context) ctx?.close?.();
    },
  };
  return api;
}
