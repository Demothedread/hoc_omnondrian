// DESCRIPTION: Saves explicitly submitted project drafts only on the local Astro development server.
// INPUTS: Same-origin loopback JSON requests containing a safe slug, title and Markdown.
// OUTPUTS: New exclusive CMS draft files and extracted embedded raster images.
// DEPENDENCIES: Node filesystem/crypto and the shared project draft serializer.
import { mkdir, writeFile, access, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { projectDraft } from './document.js';

const LIMIT = 24 * 1024 * 1024;
export function validateDraft(data) {
  if (!data || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(data.slug ?? '')) throw new Error('Choose a URL name using 1–60 lowercase letters, numbers or hyphens.');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new Error('Add a title of up to 200 characters.');
  if (typeof data.markdown !== 'string' || !data.markdown.trim() || data.markdown.length > LIMIT) throw new Error('Add a document smaller than 24 MB.');
  const words = Number(data.words ?? 150);
  if (!Number.isInteger(words) || words < 40 || words > 400) throw new Error('Words per spread must be between 40 and 400.');
  if (!['deck', 'report'].includes(data.format)) throw new Error('Choose magazine or report format.');
  return { ...data, title: data.title.trim(), words };
}
export async function saveStudioDraft(root, input) {
  const data = validateDraft(input);
  const path = resolve(root, 'src/content/projects', `${data.slug}.mdoc`);
  try { await access(path); const e = new Error('That project URL already exists. Choose a new URL name; the existing project has been kept.'); e.status = 409; throw e; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const images = [];
  const markdown = data.markdown.replace(/data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)/g, (_, type, encoded) => {
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length > 8 * 1024 * 1024) throw new Error('An embedded image exceeds 8 MB. Resize it before importing.');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 20);
    const name = `import-${hash}.${type === 'jpeg' ? 'jpg' : type}`;
    images.push({ name, buffer });
    return `/images/projects/${name}`;
  });
  if (/data:image\//i.test(markdown)) throw new Error('Embedded images must be PNG, JPEG, WebP or GIF.');
  const content = projectDraft({ ...data, markdown });
  const imageDir = resolve(root, 'public/images/projects');
  await mkdir(resolve(root, 'src/content/projects'), { recursive: true });
  await mkdir(imageDir, { recursive: true });
  const created = [];
  // Exclusive creation is also the concurrency guard: a second save can never replace a first.
  try { await writeFile(path, content, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') { e.status = 409; e.message = 'That project URL already exists. Choose another URL name.'; } throw e; }
  try {
    for (const image of images) {
      const imagePath = resolve(imageDir, image.name);
      try { await writeFile(imagePath, image.buffer, { flag: 'wx' }); created.push(imagePath); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
  } catch (e) { await unlink(path); await Promise.all(created.map((p) => unlink(p))); throw e; }
  return { slug: data.slug, draft: true, cms: '/keystatic', path: `src/content/projects/${data.slug}.mdoc` };
}

export function studioDevelopmentPlugin(root) {
  return { name: 'hocomnia-local-project-studio', apply: 'serve', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split('?')[0];
      if (!path?.startsWith('/__studio/')) return next();
      const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(data)); };
      const remote = req.socket.remoteAddress;
      if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)) return send(403, { error: 'Draft saving is available only on this computer.' });
      if (path === '/__studio/status' && req.method === 'GET') {
        const slug = new URL(req.url, `http://${req.headers.host}`).searchParams.get('slug');
        let exists = false;
        if (slug && /^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) { try { await access(resolve(root, 'src/content/projects', `${slug}.mdoc`)); exists = true; } catch {} }
        return send(200, { local: true, exists });
      }
      if (path !== '/__studio/save' || req.method !== 'POST') return send(404, { error: 'Unknown studio action.' });
      if (req.headers.origin !== `http://${req.headers.host}` || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Save the draft from this site’s Project Studio.' });
      try {
        let bytes = 0; const chunks = [];
        for await (const chunk of req) { bytes += chunk.length; if (bytes > LIMIT) throw Object.assign(new Error('Document exceeds the 24 MB save limit.'), { status: 413 }); chunks.push(chunk); }
        const result = await saveStudioDraft(root, JSON.parse(Buffer.concat(chunks).toString('utf8')));
        send(201, result);
      } catch (e) { send(e.status ?? 400, { error: e.message || 'The draft could not be saved.' }); }
    });
  } };
}
