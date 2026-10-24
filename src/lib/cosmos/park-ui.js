// DESCRIPTION: Presents the destination map, content index and illustrated résumé host.
// INPUTS: Cosmos modules, base URL, current route and navigation callback.
// OUTPUTS: Semantic park chrome and lifecycle controls for its interactions.
// DEPENDENCIES: Motion animate, journeyStations and HTML escaping.
import { animate } from 'motion';
import { escapeHtml } from '../illusion/config.js';
import { journeyStations } from './journey.js';

export function parkMarkup(modules, base = '/') {
  return `<div class="park-ui">
    <details class="park-directory"><summary>Park map <span aria-hidden="true">＋</span></summary><nav aria-label="Destinations"><a href="${base}" data-park-route="">The whole park</a>${modules.map((m, i) => `<a href="${base}${escapeHtml(m.id)}" data-park-route="${escapeHtml(m.id)}"><span>${String(i + 1).padStart(2, '0')}</span>${escapeHtml(m.title)}</a>`).join('')}</nav></details>
    <details class="park-index" hidden><summary>Section index</summary><nav aria-label="Current section" data-park-index></nav></details>
    <div class="park-journey" hidden aria-label="Résumé journey"><div><span data-journey-count></span><strong data-journey-title></strong></div><button type="button" data-journey-prev aria-label="Previous station">←</button><button type="button" data-journey-next aria-label="Next station">Next station →</button></div>
    <aside class="park-host" hidden aria-label="Jonathan, your guide"><img src="${escapeHtml(modules.find((m) => m.id === 'about')?.avatar || `${base}images/host/jonathan-park-host.png`)}" alt="Illustrated Jonathan, smiling in a blue jacket and open-collar shirt" width="1024" height="1536"><div class="park-host__bubble"><button type="button" data-host-close aria-label="Dismiss guide">×</button><p class="park-host__eyebrow">A note from Jonathan</p><p data-host-text aria-live="polite"></p><a data-host-link href="${base}resume" data-park-route="resume">Take the journey →</a></div></aside>
    <button type="button" class="park-host-toggle" data-host-toggle hidden>Meet your guide</button>
  </div>`;
}

export function mountParkUI(root, modules, { base = '/', navigate, isReduced }) {
  const ui = root.querySelector('.park-ui');
  const directory = ui.querySelector('.park-directory');
  const index = ui.querySelector('.park-index');
  const indexNav = ui.querySelector('[data-park-index]');
  const journey = ui.querySelector('.park-journey');
  const host = ui.querySelector('.park-host');
  const toggle = ui.querySelector('[data-host-toggle]');
  const stations = journeyStations(modules);
  const hud = root.querySelector('.cos-hud');
  const hudObserver = new ResizeObserver(() => ui.style.setProperty('--park-nav-top', `${Math.ceil(hud.offsetTop + hud.offsetHeight + 12)}px`));
  hudObserver.observe(hud);
  let current = '';
  let dismissed = false;
  let lastStation = null;
  let journeyPosition = -1;
  let animation = null;
  const go = (route) => navigate(route);
  const link = (route, text, active = false) => `<a href="${base}${escapeHtml(route)}" data-park-route="${escapeHtml(route)}"${active ? ' aria-current="location"' : ''}>${escapeHtml(text)}</a>`;

  function update(route) {
    const wasVisible = !host.hidden;
    current = route;
    const [moduleId, itemId] = route.split('/');
    const module = modules.find((m) => m.id === moduleId);
    const item = module?.items.find((i) => i.id === itemId);
    const station = stations.find((s) => s.route === route);
    if (station) lastStation = station;
    const detour = !station && lastStation?.destination && (route === lastStation.destination || route.startsWith(`${lastStation.destination}/`));
    const context = station ?? (detour ? lastStation : null);
    const project = moduleId === 'projects' && item;
    const rows = project
      ? [...root.querySelectorAll(`[data-seq="${CSS.escape(`projects/${itemId}`)}"]`)].map((el, i) => ({ route: el.dataset.route, title: el.querySelector('h2')?.textContent ?? `Section ${i + 1}` }))
      : moduleId === 'resume' ? stations : (module?.items ?? []).map((i) => ({ route: `${moduleId}/${i.id}`, title: i.title }));
    if (project && root.querySelector(`[data-route="projects/${CSS.escape(itemId)}/report"]`)) rows.push({ route: `projects/${itemId}/report`, title: 'Read continuously' });
    index.hidden = !rows.length;
    index.querySelector('summary').textContent = project ? 'In this project' : moduleId === 'resume' ? 'Journey stations' : 'In this destination';
    indexNav.innerHTML = rows.map((r, i) => link(r.route, `${String(i + 1).padStart(2, '0')}  ${r.title}`, r.route === route)).join('');
    ui.querySelectorAll('.park-directory a').forEach((a) => { if (a.dataset.parkRoute === moduleId || (!route && !a.dataset.parkRoute)) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const inJourney = moduleId === 'resume' || moduleId === 'about' || detour;
    root.classList.toggle('in-journey', !!inJourney);
    journey.hidden = !inJourney || !stations.length;
    const n = context ? stations.indexOf(context) : -1;
    journeyPosition = n;
    ui.querySelector('[data-journey-count]').textContent = context ? `${detour ? 'DETOUR FROM ' : ''}STATION ${n + 1} / ${stations.length} · ${context.type}` : 'THE RÉSUMÉ JOURNEY';
    ui.querySelector('[data-journey-title]').textContent = detour ? `${module?.title || 'Explore'} · ${context.title}` : station?.title ?? 'Professional paths. Personal detours.';
    ui.querySelector('[data-journey-prev]').disabled = n < 1;
    ui.querySelector('[data-journey-next]').textContent = n === stations.length - 1 ? 'Back to the map ↗' : n < 0 ? 'Start the journey →' : 'Next station →';
    host.hidden = !inJourney || dismissed;
    toggle.hidden = !inJourney || !dismissed;
    const text = detour ? `This is ${module?.title || 'another part of the park'}, a detour from “${context.title}”. Take a look around, then continue to the next résumé station when you’re ready.` : station?.commentary || (station
      ? `${station.section}. ${station.type === 'personal' ? 'A personal detour along the way.' : 'A station on the professional path.'} Explore the details here, then continue at your own pace.`
      : moduleId === 'about' ? (module?.greeting || 'Hi, I’m Jonathan. Welcome to my corner of the park. Follow the stations through the résumé, or take a detour into the work, writing and photographs.') : 'A résumé is a journey through places and ideas. Each numbered station lives in this painting. Use the index or follow the path one stop at a time.');
    ui.querySelector('[data-host-text]').textContent = text;
    const related = station?.destination;
    const target = related && root.querySelector(`[data-route="${CSS.escape(related)}"]`) ? related : stations[n + 1]?.route ?? stations[0]?.route ?? 'resume';
    const hostLink = ui.querySelector('[data-host-link]');
    hostLink.href = `${base}${target}`;
    hostLink.dataset.parkRoute = target;
    hostLink.textContent = related && target === related ? 'Explore this detour ↗' : context ? 'Continue the journey →' : 'Start the résumé journey →';
    animation?.stop();
    if (!host.hidden && !isReduced()) animation = animate(host, { opacity: [wasVisible ? 0.6 : 0, 1], y: [wasVisible ? 8 : 85, 0], rotate: [wasVisible ? 0 : -3, 0] }, { type: 'spring', stiffness: 180, damping: 22 });
  }
  function onClick(e) {
    const a = e.target.closest('a[data-park-route]');
    if (a) { e.preventDefault(); directory.open = false; index.open = false; go(a.dataset.parkRoute); return; }
    if (e.target.closest('[data-host-close]')) { dismissed = true; update(current); }
    if (e.target.closest('[data-host-toggle]')) { dismissed = false; update(current); }
    const n = journeyPosition;
    if (e.target.closest('[data-journey-next]')) go(n === stations.length - 1 ? 'resume' : stations[n + 1]?.route ?? stations[0]?.route ?? 'resume');
    if (e.target.closest('[data-journey-prev]') && n > 0) go(stations[n - 1].route);
  }
  ui.addEventListener('click', onClick);
  function closeMenus(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'pointerdown' && ui.contains(e.target)) return;
    if (e.type === 'keydown' && (directory.open || index.open)) { e.preventDefault(); e.stopPropagation(); }
    directory.open = false; index.open = false;
  }
  // Capture Escape before the world treats it as travel to a parent destination.
  root.addEventListener('keydown', closeMenus, true);
  root.addEventListener('pointerdown', closeMenus, true);
  return { update, destroy() { animation?.stop(); hudObserver.disconnect(); ui.removeEventListener('click', onClick); root.removeEventListener('keydown', closeMenus, true); root.removeEventListener('pointerdown', closeMenus, true); } };
}
