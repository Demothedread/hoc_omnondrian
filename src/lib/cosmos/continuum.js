// DESCRIPTION: Extends the portfolio painting with a seamless, recursively composed optical ground.
// INPUTS: World model, camera state, viewport dimensions and world dimensions.
// OUTPUTS: A reusable SVG tile, camera-aligned background projection and repeated-field picking.
// DEPENDENCIES: worldLeaves and HTML escaping; no renderer or animation runtime.
import { worldLeaves } from './world.js';
import { escapeHtml } from '../illusion/config.js';

const mod = (n, size) => ((n % size) + size) % size;

export function boardPoint(x, y, world) {
  return { x: mod(x, world.w), y: mod(y, world.h) };
}

export function boardProjection(camera, viewport, world) {
  const scale = viewport.w / camera.w;
  return {
    width: world.w * scale, height: world.h * scale,
    x: mod(viewport.w / 2 - camera.x * scale, world.w * scale),
    y: mod(viewport.h / 2 - camera.y * scale, world.h * scale),
  };
}

export function boardTile(model, world) {
  const leaves = worldLeaves(model);
  const painting = leaves.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${escapeHtml(r.fill)}"/>`).join('');
  // Repeated whole paintings inside selected paper fields create a Droste depth cue.
  // These are visual echoes, so only the original portfolio contributes accessible content.
  const echoes = leaves.filter((r) => r.fill.toLowerCase() === '#eeeeea' && r.w > 650 && r.h > 650).slice(0, 8).map((r) => {
    const scale = Math.min(r.w * 0.72 / world.w, r.h * 0.72 / world.h);
    const x = r.x + (r.w - world.w * scale) / 2, y = r.y + (r.h - world.h * scale) / 2;
    return `<use href="#painting" transform="translate(${x} ${y}) scale(${scale})"/>`;
  }).join('');
  const labels = model.regions.filter((r) => r.module).map((r) => {
    const cell = r.leaves.find((l) => l.role === 'content');
    if (!cell) return '';
    const x = r.rect.x + cell.x + 35, y = r.rect.y + cell.y + cell.h - 40;
    return `<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${Math.min(140, cell.w / 8)}" font-weight="800" fill="#111">${escapeHtml(r.module.title)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${world.w}" height="${world.h}" viewBox="0 0 ${world.w} ${world.h}"><defs><g id="painting"><path fill="#111" d="M0 0h${world.w}v${world.h}H0z"/>${painting}</g></defs><use href="#painting"/>${echoes}${labels}</svg>`;
}

export function repeatedDestination(model, x, y, world) {
  if (x >= 0 && y >= 0 && x < world.w && y < world.h) return null;
  const point = boardPoint(x, y, world);
  const region = model.regions.find(({ rect: r }) => point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h);
  return region?.module?.id ?? null;
}

export function mountContinuum(element, model, world) {
  let last = '';
  function updateModel(next) {
    element.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(boardTile(next, world))}")`;
  }
  updateModel(model);
  return {
    updateModel,
    update(camera, viewport) {
      const p = boardProjection(camera, viewport, world);
      const signature = [p.width, p.height, p.x, p.y, camera.tilt].map((n) => n.toFixed(3)).join(',');
      if (signature === last) return;
      last = signature;
      element.style.backgroundSize = `${p.width}px ${p.height}px`;
      element.style.backgroundPosition = `${p.x}px ${p.y}px`;
      element.style.transform = camera.tilt > 0.05 ? `rotateX(${camera.tilt}deg)` : 'none';
    },
  };
}
