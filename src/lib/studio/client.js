// DESCRIPTION: Imports documents, previews native spreads and reorders source sections in Project Studio.
// INPUTS: User files, source text, order changes and explicit save/export actions.
// OUTPUTS: Editorial previews, accessible order feedback and CMS drafts or downloads.
// DEPENDENCIES: Document mapper, shared editorial renderer, mammoth and local save endpoint.
import { partitionDocument, joinDocument, projectSlug, projectDraft } from './document.js';
import { documentToProject } from '../site/doc-to-deck.js';
import { renderEditorialSpread } from '../stijl/editorial.js';
import { escapeHtml } from '../illusion/config.js';

const root = document.querySelector('[data-studio]');
if (root) {
  const $ = (sel) => root.querySelector(sel);
  let documentModel = null, local = false, dragIndex = -1, loading = false;
  const status = (text) => { $('[data-status]').textContent = text; };
  const error = (text = '') => { $('[data-error]').hidden = !text; $('[data-error]').textContent = text; };
  const data = () => ({ title: $('[data-title]').value.trim(), slug: $('[data-slug]').value.trim(), markdown: joinDocument(documentModel), format: $('[data-format]').value, words: Number($('[data-words]').value) });
  const SESSION_KEY = 'hocomnia:project-studio';
  function remember(message = '') {
    if (!documentModel) return;
    const { markdown, ...metadata } = data();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ documentModel, ...metadata, message })); } catch { /* Large files can exceed session quota; the explicit download remains available. */ }
  }
  function busy(value) { loading = value; root.setAttribute('aria-busy', String(value)); $('[data-save]').disabled = value || !local; $('[data-export]').disabled = value; $('[data-file]').disabled = value; }
  function render() {
    if (!documentModel) return;
    const input = data();
    const project = documentToProject(input.markdown, { title: input.title, maxWords: input.words });
    $('[data-parts]').innerHTML = documentModel.parts.map((part, i) => `<li draggable="true" data-part="${i}"><span class="studio-grip" aria-hidden="true">⠿</span><span>${escapeHtml(part.title)}</span><button type="button" data-move="-1" data-index="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(part.title)} earlier">↑</button><button type="button" data-move="1" data-index="${i}" ${i === documentModel.parts.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(part.title)} later">↓</button></li>`).join('');
    $('[data-preview]').innerHTML = project.slides.map((slide, i) => `<div class="studio-spread">${renderEditorialSpread(slide, { index: i, total: project.slides.length, title: input.title })}</div>`).join('');
    status(`${documentModel.parts.length} source sections · ${project.slides.length} composed spreads. ${input.format === 'report' ? 'The project will open as continuous reading; the spreads remain accessible.' : 'Ready to explore as magazine spreads.'}`);
    remember();
  }
  function load(markdown, fallbackTitle) {
    documentModel = partitionDocument(markdown, fallbackTitle);
    $('[data-title]').value = documentModel.title;
    $('[data-slug]').value = projectSlug(documentModel.title);
    $('[data-workspace]').hidden = false;
    render();
  }
  async function importFile(file) {
    error();
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return error('Choose a document smaller than 12 MB.');
    if (!/\.(md|markdown|mdoc|txt|docx)$/i.test(file.name)) return error('Choose a Markdown, Markdoc, text or DOCX document.');
    busy(true); status('Reading the document and composing its sections…');
    try {
      let markdown;
      if (/\.docx$/i.test(file.name)) {
        const mod = await import('mammoth/mammoth.browser.js');
        const mammoth = mod.default ?? mod;
        const result = await mammoth.convertToMarkdown({ arrayBuffer: await file.arrayBuffer() }, { convertImage: mammoth.images.imgElement(async (image) => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })) });
        markdown = result.value.replace(/\\([.()\-!#*_[\]])/g, '$1');
        if (result.messages.length) error(`Word import notes: ${result.messages.map((m) => m.message).join(' ')} Review the preview before saving.`);
      } else markdown = await file.text();
      load(markdown, file.name.replace(/\.[^.]+$/, ''));
    } catch (e) { error(`Could not read the document. ${e.message}`); status('The current project has been kept. Choose another file or paste its text.'); }
    finally { busy(false); }
  }
  function move(from, to) {
    if (from < 0 || to < 0 || from === to || to >= documentModel.parts.length) return;
    const [part] = documentModel.parts.splice(from, 1); documentModel.parts.splice(to, 0, part); render();
    status(`${part.title} moved to position ${to + 1}. The preview follows the new reading order.`);
    $(`[data-part="${to}"] button:not([disabled])`)?.focus();
  }
  $('[data-file]').addEventListener('change', (e) => importFile(e.target.files[0]));
  $('[data-generate]').addEventListener('click', () => { error(); try { load($('[data-source]').value, 'Project'); } catch(e) { error(e.message); } });
  ['[data-title]', '[data-format]', '[data-words]'].forEach((sel) => $(sel).addEventListener('change', render));
  $('[data-slug]').addEventListener('change', () => remember());
  const parts = $('[data-parts]');
  parts.addEventListener('click', (e) => { const button = e.target.closest('[data-move]'); if (button) move(Number(button.dataset.index), Number(button.dataset.index) + Number(button.dataset.move)); });
  parts.addEventListener('dragstart', (e) => { dragIndex = Number(e.target.closest('[data-part]')?.dataset.part ?? -1); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragIndex)); });
  parts.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  parts.addEventListener('drop', (e) => { e.preventDefault(); const to = Number(e.target.closest('[data-part]')?.dataset.part ?? -1); move(dragIndex, to); dragIndex = -1; });
  const drop = $('[data-drop]');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); if (!loading) importFile(e.dataTransfer.files[0]); });
  $('[data-export]').addEventListener('click', () => {
    error(); try { const input = data(); const url = URL.createObjectURL(new Blob([projectDraft(input)], { type: 'text/markdown' })); const a = document.createElement('a'); a.href = url; a.download = `${projectSlug(input.slug || input.title)}.mdoc`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Downloaded the draft with the current section order.'); } catch (e) { error(e.message); }
  });
  $('[data-save]').addEventListener('click', async () => {
    error(); busy(true);
    const input = data();
    remember();
    try { sessionStorage.setItem('hocomnia:pending-save', input.slug); } catch { /* Session recovery is optional; quota must not prevent an explicit filesystem save. */ }
    try { const response = await fetch('/__studio/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Draft could not be saved.'); const message = `Saved ${result.path}. It is a draft until you publish it in the CMS.`; status(message); remember(message); $('[data-save-help]').innerHTML = '<a href="/keystatic">Open the CMS to review and publish →</a>'; }
    catch (e) { error(e.message); } finally { busy(false); }
    try { sessionStorage.removeItem('hocomnia:pending-save'); } catch { /* Storage can be disabled by browser policy. */ }
  });
  $('[data-new]').addEventListener('click', () => {
    documentModel = null;
    sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('hocomnia:pending-save');
    $('[data-workspace]').hidden = true; $('[data-file]').value = ''; $('[data-source]').value = '';
    error(); status('Choose the next document to begin a new project. Your saved drafts remain in the CMS.');
    $('[data-file]').focus();
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (saved?.documentModel?.cover && Array.isArray(saved.documentModel.parts)) {
      documentModel = saved.documentModel;
      $('[data-title]').value = saved.title; $('[data-slug]').value = saved.slug;
      $('[data-format]').value = saved.format; $('[data-words]').value = saved.words;
      $('[data-workspace]').hidden = false; render();
      if (saved.message) { status(saved.message); remember(saved.message); }
    }
    const pending = sessionStorage.getItem('hocomnia:pending-save');
    if (pending) fetch(`/__studio/status?slug=${encodeURIComponent(pending)}`).then((r) => r.json()).then((r) => {
      if (r.exists) { const message = `Saved src/content/projects/${pending}.mdoc as a draft. Open the CMS to review and publish.`; status(message); remember(message); }
      else status('Your preview was restored. The save was interrupted; you can save again.');
      sessionStorage.removeItem('hocomnia:pending-save');
    }).catch(() => {});
  } catch { /* Session restoration is optional; importing a file always remains available. */ }
  fetch('/__studio/status').then((response) => response.ok ? response.json() : null).then((result) => { local = result?.local === true; $('[data-save]').disabled = !local; $('[data-save-help]').textContent = local ? 'Save creates a new local CMS draft. Existing projects are never overwritten.' : 'On this static copy, download the draft and add it to the CMS. Local development also supports saving directly.'; }).catch(() => { $('[data-save-help]').textContent = 'Download the draft to keep it. Local saving is not available on this server.'; });
}
