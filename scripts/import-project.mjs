#!/usr/bin/env node
/**
 * scripts/import-project.mjs — turn a document into a project (and a presentation)
 * ---------------------------------------------------------------------------
 *   npm run import -- path/to/file.docx
 *   npm run import -- notes.md --slug tesla --kind Presentation --format deck
 *   npm run import -- report.txt --dry          (show how it would be read; write nothing)
 *
 * Reads .docx (Word, or Google Docs → File → Download → .docx), .md / .mdoc,
 * .txt and .html. Finds the structure (see src/lib/site/doc-to-deck.js),
 * saves src/content/projects/<slug>.mdoc (it then appears in the CMS under
 * Projects), copies images into public/images/projects/, and prints the
 * slides it will become. Edit anything afterwards in the CMS.
 *
 * Options: --slug <name>  --kind <Presentation|Report|…>  --format <deck|report>
 *          --words <n> (words per slide)  --force (overwrite)  --dry
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentToProject, inferHeadings } from '../src/lib/site/doc-to-deck.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

export const slugify = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : ENTITIES[e.toLowerCase()] ?? m));

/** Small HTML → Markdown converter: headings, paragraphs, lists, quotes, images, emphasis, links, rules. */
export function htmlToMarkdown(html) {
  let s = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(+n)} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`);
  s = s.replace(/<img[^>]*?src="([^"]+)"[^>]*?>/gi, (m, src) => `\n\n![${(m.match(/alt="([^"]*)"/i) ?? [])[1] ?? ''}](${src}${(m.match(/title="([^"]*)"/i) ?? [])[1] ? ` "${m.match(/title="([^"]*)"/i)[1]}"` : ''})\n\n`);
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n${t.replace(/<\/?p[^>]*>/gi, '\n').trim().split(/\n+/).map((l) => `> ${l.trim()}`).join('\n')}\n\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<\/?p[^>]*>/gi, ' ').trim()}`);
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n\n');
  s = s.replace(/<hr[^>]*>/gi, '\n\n---\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**').replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<\/(p|div|section|article|header|footer)>/gi, '\n\n').replace(/<[^>]+>/g, '');
  return decode(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Read any supported file as Markdown (images from .docx are saved to public/images/projects/). */
export async function readAsMarkdown(file, { slug = 'project', dry = false } = {}) {
  const ext = extname(file).toLowerCase();
  if (['.md', '.markdown', '.mdoc', '.txt'].includes(ext)) return readFileSync(file, 'utf8');
  if (['.html', '.htm'].includes(ext)) return htmlToMarkdown(readFileSync(file, 'utf8'));
  if (ext === '.docx') {
    let mammoth;
    try { mammoth = (await import('mammoth')).default; } catch {
      throw new Error('Reading .docx needs mammoth: npm install mammoth');
    }
    let n = 0;
    const dir = resolve(ROOT, 'public/images/projects');
    const { value } = await mammoth.convertToMarkdown({ path: file }, {
      convertImage: mammoth.images.imgElement(async (image) => {
        const type = image.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
        const name = `${slug}-${++n}.${type}`;
        if (!dry) { mkdirSync(dir, { recursive: true }); writeFileSync(resolve(dir, name), Buffer.from(await image.read('base64'), 'base64')); }
        return { src: `/images/projects/${name}` };
      }),
    });
    return value.replace(/\\([.()\-!#*_[\]])/g, '$1'); // mammoth escapes punctuation; unescape for reading
  }
  throw new Error(`Unsupported file type ${ext}: use .docx, .md, .txt or .html`);
}

const yaml = (v) => (typeof v === 'string' ? JSON.stringify(v) : v);

/** Convert a file and (unless dry) write the CMS entry. Returns { slug, path, project, markdown }. */
export async function importProject(file, o = {}) {
  const guess = slugify(o.slug ?? basename(file, extname(file)));
  const markdown = inferHeadings(await readAsMarkdown(file, { slug: guess, dry: o.dry })).trim();
  const project = documentToProject(markdown, { maxWords: o.words ?? 150 });
  const slug = slugify(o.slug ?? project.title ?? guess);
  const path = resolve(o.outDir ?? resolve(ROOT, 'src/content/projects'), `${slug}.mdoc`);
  if (!o.dry) {
    if (existsSync(path) && !o.force) throw new Error(`${path} exists. Use --force to replace it, or --slug to choose another name.`);
    const front = { title: project.title, kind: o.kind ?? 'Presentation', format: o.format ?? 'deck', summary: '', source: 'document', maxWords: o.words ?? 150, weight: 1, order: 0 };
    const body = markdown.startsWith('# ') ? markdown : `# ${project.title}\n\n${markdown}`;
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, `---\n${Object.entries(front).map(([k, v]) => `${k}: ${yaml(v)}`).join('\n')}\nslides: []\n---\n\n${body}\n`);
  }
  return { slug, path, project, markdown };
}

/** A readable outline of the slides, for the terminal. */
export function outline(project) {
  return project.slides.map((s, i) => {
    const head = s.blocks.find((b) => b.type === 'heading');
    const rows = s.blocks.map((b) => {
      const what = b.type === 'stat' ? `${b.value} (${b.label})` : b.type === 'list' ? `${b.items.length} items` : (b.text ?? b.caption ?? '').slice(0, 56);
      return `     ${b.type.padEnd(8)} ${what.padEnd(58)} ← ${b.rule}`;
    });
    return `  ${String(i + 1).padStart(2)}. ${head?.text ?? '(untitled)'}\n${rows.join('\n')}`;
  }).join('\n');
}

// --- CLI ----------------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const bool = (name) => { const i = args.indexOf(`--${name}`); if (i >= 0) { args.splice(i, 1); return true; } return false; };
  const opts = { slug: flag('slug'), kind: flag('kind'), format: flag('format'), words: flag('words') ? Number(flag('words')) : undefined, force: bool('force'), dry: bool('dry') };
  const file = args[0];
  if (!file) {
    console.log('Usage: npm run import -- <file.docx|.md|.txt|.html> [--slug name] [--kind Report] [--format deck|report] [--words 150] [--force] [--dry]');
    process.exit(1);
  }
  try {
    const { slug, path, project } = await importProject(resolve(file), opts);
    console.log(`\n${project.title}  →  ${project.slides.length} slides${opts.dry ? '  (dry run: nothing written)' : `\nSaved ${path}`}\n`);
    console.log(outline(project));
    if (!opts.dry) console.log(`\nOpen it in the CMS (Projects → ${project.title}), or see /projects/${slug} and /projects/${slug}/outline.`);
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}
