/**
 * illusion/admin.js
 * ---------------------------------------------------------------------------
 * The admin panel. It never hard-codes a control: it walks SCHEMA and
 * builds one input per field, so adding a field to config.js adds a control.
 *
 * Workflow it supports:
 *   experiment live → "Copy settings" (JSON of values changed from defaults)
 *   → paste into the CMS entry, or set the same fields in Keystatic's UI.
 *
 * Keyboard: Alt+Shift+I toggles the panel.
 */
import { ILLUSION_CONFIG, escapeHtml } from './config.js';

function formatValue(field, value) {
  if (field.type !== 'range') return '';
  const decimals = String(field.step).split('.')[1]?.length ?? 0;
  return `${Number(value).toFixed(decimals)}${field.unit ?? ''}`;
}

function controlHtml(field, value) {
  const id = `ill-f-${field.key}`;
  const help = field.help ? `<p class="ill-admin__help" id="${id}-help">${escapeHtml(field.help)}</p>` : '';
  const describedBy = field.help ? ` aria-describedby="${id}-help"` : '';

  switch (field.type) {
    case 'select':
      return `<label class="ill-admin__label" for="${id}">${escapeHtml(field.label)}</label>
        <select id="${id}" data-key="${field.key}"${describedBy}>
          ${field.options.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('')}
        </select>${help}`;
    case 'range':
      return `<div class="ill-admin__row"><label class="ill-admin__label" for="${id}">${escapeHtml(field.label)}</label>
        <output for="${id}" data-out="${field.key}">${formatValue(field, value)}</output></div>
        <input id="${id}" type="range" data-key="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"${describedBy}>${help}`;
    case 'toggle':
      return `<label class="ill-admin__toggle"><input type="checkbox" data-key="${field.key}"${value ? ' checked' : ''}${describedBy}> ${escapeHtml(field.label)}</label>${help}`;
    case 'text':
      return `<label class="ill-admin__label" for="${id}">${escapeHtml(field.label)}</label>
        <input id="${id}" type="text" data-key="${field.key}" value="${escapeHtml(value)}" maxlength="120"${describedBy}>${help}`;
    default:
      return '';
  }
}

/**
 * @param {HTMLElement} panel   empty container (an <aside> is ideal)
 * @param {ReturnType<import('./store.js').createIllusionStore>} store
 * @param {{ onClose?: () => void, title?: string }} [options]
 *        The schema comes from the store (store.config), so one panel serves
 *        both the illusion stage and the cosmos world.
 */
export function mountAdmin(panel, store, { onClose, title = 'Illusion controls' } = {}) {
  const { schema: SCHEMA, diff: diffFromDefaults } = store.config ?? ILLUSION_CONFIG;
  const cfg = store.get();
  const fields = SCHEMA.flatMap((s) => s.fields);

  panel.classList.add('ill-admin');
  panel.innerHTML = `
    <header class="ill-admin__head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="ill-admin__close" data-action="close" aria-label="Close controls">×</button>
    </header>
    <div class="ill-admin__body">
      ${SCHEMA.map((section) => `
        <fieldset class="ill-admin__section">
          <legend>${escapeHtml(section.label)}</legend>
          ${section.fields.map((f) => `<div class="ill-admin__field" data-field="${f.key}">${controlHtml(f, cfg[f.key])}</div>`).join('')}
        </fieldset>`).join('')}
    </div>
    <footer class="ill-admin__foot">
      <button type="button" data-action="copy">Copy settings</button>
      <button type="button" data-action="shuffle">New composition</button>
      <button type="button" data-action="reset">Reset</button>
      <p class="ill-admin__status" role="status" aria-live="polite"></p>
      <textarea class="ill-admin__export" readonly hidden aria-label="Settings as JSON"></textarea>
    </footer>`;

  const status = panel.querySelector('.ill-admin__status');
  const exportBox = panel.querySelector('.ill-admin__export');

  // Inputs → store. Every change is live on the stage.
  panel.addEventListener('input', (e) => {
    const key = e.target.dataset?.key;
    if (!key) return;
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    store.set({ [key]: value });
  });

  panel.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') onClose?.();
    if (action === 'reset') { store.reset(); status.textContent = 'Back to the published settings.'; }
    if (action === 'shuffle') store.set({ seed: 1 + Math.floor(Math.random() * 9998) });
    if (action === 'copy') {
      const json = JSON.stringify(diffFromDefaults(store.get()), null, 2);
      try {
        await navigator.clipboard.writeText(json);
        exportBox.hidden = true;
        status.textContent = 'Settings copied. Paste them into the CMS entry.';
      } catch {
        // Clipboard blocked (e.g. inside an iframe): show the JSON to copy by hand.
        exportBox.hidden = false;
        exportBox.value = json;
        exportBox.select();
        status.textContent = 'Copy the settings below.';
      }
    }
  });

  // Store → inputs (keeps controls honest after reset/shuffle) and field visibility.
  function sync(state) {
    for (const f of fields) {
      const wrap = panel.querySelector(`[data-field="${f.key}"]`);
      if (!wrap) continue;
      wrap.hidden = f.when ? !f.when(state) : false;
      const input = wrap.querySelector('[data-key]');
      if (input && document.activeElement !== input) {
        if (f.type === 'toggle') input.checked = state[f.key];
        else input.value = state[f.key];
      }
      const out = wrap.querySelector('[data-out]');
      if (out) out.textContent = formatValue(f, state[f.key]);
    }
  }
  const unsubscribe = store.subscribe(sync);
  sync(cfg);

  return { destroy() { unsubscribe(); panel.replaceChildren(); } };
}

/** Alt+Shift+I toggles the panel. Returns a function that removes the shortcut. */
export function bindAdminShortcut(toggle) {
  const onKey = (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyI') { e.preventDefault(); toggle(); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
