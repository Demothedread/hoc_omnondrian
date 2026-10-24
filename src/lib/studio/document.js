// DESCRIPTION: Keeps source Markdown intact while splitting and reordering project sections.
// INPUTS: Markdown/Markdoc text and project title, format and source metadata.
// OUTPUTS: Reorderable source sections and Keystatic-compatible draft documents.
// DEPENDENCIES: Existing heading inference and document mapper.
import { documentToProject, inferHeadings, isLabel } from '../site/doc-to-deck.js';
export const projectSlug = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project';
export function partitionDocument(raw, fallbackTitle = 'Project') {
  const source = inferHeadings(String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''));
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle;
  const parts = [];
  let buffer = [], fence = false;
  const flush = () => { const markdown = buffer.join('\n').trim(); if (markdown) parts.push({ id: `part-${parts.length}`, title: markdown.match(/^#{1,2}\s+(.+)$/m)?.[1] || `Section ${parts.length + 1}`, markdown }); buffer = []; };
  for (const line of source.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && (/^#{1,2}\s+/.test(line) || /^---+$/.test(line))) {
      const preceding = [...buffer].reverse().findIndex((s) => s.trim());
      const at = preceding < 0 ? -1 : buffer.length - preceding - 1;
      const label = /^##\s/.test(line) && at >= 0 && isLabel(buffer[at]) ? buffer.splice(at).join('\n').trim() : '';
      flush();
      if (label) buffer.push(label);
      if (/^---+$/.test(line)) continue;
    }
    buffer.push(line);
  }
  flush();
  if (!parts.length) throw new Error('The document is empty. Add a title or some content.');
  const firstIsCover = /^#\s/m.test(parts[0].markdown);
  const cover = firstIsCover ? parts.shift().markdown : `# ${title}`;
  return { title, cover, parts };
}
export const joinDocument = ({ cover, parts }) => [cover, ...parts.map((p) => p.markdown)].filter(Boolean).join('\n\n');
export function projectDraft({ title, markdown, format = 'deck', words = 150 }) {
  const mapped = documentToProject(markdown, { title, maxWords: words });
  if (!mapped.slides.length) throw new Error('No sections could be read from this document.');
  const front = { title, kind: 'Project', format: format === 'report' ? 'report' : 'deck', draft: true, summary: mapped.summary || '', source: 'document', maxWords: words, weight: 1, order: 0 };
  return `---\n${Object.entries(front).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\nslides: []\n---\n\n${markdown.trim()}\n`;
}
