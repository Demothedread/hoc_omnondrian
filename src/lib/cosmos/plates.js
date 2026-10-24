// DESCRIPTION: Choreographs transient destination plates independently of the world camera.
// INPUTS: Cosmos root, rack-focus controller, title writer and reduced-motion predicate.
// OUTPUTS: Cancellable begin/finish/cancel/destroy transition controls.
// DEPENDENCIES: Motion DOM animate and the park title/stage CSS.
import { animate } from 'motion';

export function createDestinationPlates(root, { rack, setTitle, isReduced, focusDuration = () => 0.9, shouldRack = () => true }) {
  const plate = root.querySelector('.cos-title');
  const stage = root.querySelector('.cos-stage');
  const sheen = root.querySelector('.park-plate__sheen');
  let active = null;
  let counter = 0;
  const animations = new Set();
  const run = (el, frames, options) => {
    const control = animate(el, frames, options);
    animations.add(control);
    Promise.resolve(control).then(() => animations.delete(control));
    return control;
  };
  function cancel(token = null) {
    if (token && token !== active) return;
    active?.abort();
    active = null;
    animations.forEach((control) => control.stop());
    animations.clear();
    root.classList.remove('park-entering', 'has-title');
    root.dataset.platePhase = 'clear';
    plate.style.opacity = '0';
    stage?.removeAttribute('style');
    rack.focusOn('map');
  }
  function begin(title, sub = '', route = '') {
    cancel();
    let abort;
    const token = { id: ++counter, started: performance.now(), cancelled: new Promise((r) => { abort = r; }), abort: () => abort(false) };
    active = token;
    setTitle(title, sub);
    root.dataset.plateRoute = route;
    root.dataset.platePhase = 'enter';
    root.classList.add('park-entering', 'has-title');
    root.classList.remove('is-receded');
    plate.style.opacity = '1';
    if (isReduced()) {
      plate.style.transform = 'none';
      rack.focusOn('map');
      return token;
    }
    rack.focusOn(shouldRack() ? 'near' : 'map');
    Promise.resolve(run(plate, { opacity: [0, 1], scale: [0.84, 1], y: [28, 0], rotateX: [9, 0], filter: ['blur(8px)', 'blur(0px)'] }, { duration: 0.55, ease: [0.16, 1, 0.3, 1] })).then(() => { if (active === token) root.dataset.platePhase = 'focus'; });
    if (sheen) run(sheen, { x: ['-160%', '280%'] }, { duration: 1.15, ease: 'easeInOut', delay: 0.22 });
    if (stage) run(stage, { rotate: [0, -0.5, 0.35, -0.16, 0], y: [0, 5, -3, 1, 0] }, { duration: 1.15, ease: 'easeInOut' });
    return token;
  }
  async function finish(token) {
    if (token !== active) return false;
    const hold = Math.max(0, (isReduced() ? 120 : Math.max(1000, focusDuration() * 1000 + 200)) - (performance.now() - token.started));
    await Promise.race([new Promise((r) => setTimeout(r, hold)), token.cancelled]);
    if (token !== active) return false;
    rack.focusOn('map');
    root.dataset.platePhase = 'pass';
    if (!isReduced()) {
      const out = run(plate, { scale: [1, 1.08, 3.2], y: [0, -8, -90], opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(0px)', 'blur(10px)'] }, { duration: 0.65, times: [0, 0.25, 1], ease: [0.6, 0, 1, 0.45] });
      if (stage) run(stage, { scale: [1.035, 1], y: [-22, 0], rotate: [-0.18, 0] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
      await Promise.race([Promise.resolve(out), token.cancelled]);
    }
    if (token !== active) return false;
    root.classList.remove('park-entering', 'has-title');
    root.dataset.platePhase = 'clear';
    root.classList.add('is-receded');
    plate.style.opacity = '0';
    animations.forEach((control) => control.stop()); animations.clear();
    stage?.removeAttribute('style');
    active = null;
    return true;
  }
  return { begin, finish, cancel, destroy: cancel };
}
