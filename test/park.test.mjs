// DESCRIPTION: Verifies park station addresses, editorial content preservation and safe draft creation.
// INPUTS: Duplicate section names, source Markdown and temporary local draft directories.
// OUTPUTS: Assertions over public module interfaces and persisted draft content.
// DEPENDENCIES: Node assertions/filesystem and the park/studio pure functions.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { journeySections, journeyStations } from '../src/lib/cosmos/journey.js';
import { renderEditorialSpread, layoutEditorialPages } from '../src/lib/stijl/editorial.js';
import { partitionDocument, joinDocument } from '../src/lib/studio/document.js';
import { saveStudioDraft, validateDraft } from '../src/lib/studio/server.mjs';

const items = journeySections({ sections: [{ heading: 'Career', entries: [{ title: 'Role' }, { title: 'Role', type: 'personal', commentary: 'My aside', destination: 'gallery' }] }, { heading: 'Career', entries: [{ title: 'Role' }] }] });
const stations = journeyStations([{ id: 'resume', items }]);
assert.equal(new Set(stations.map((s) => s.route)).size, 3);
assert.deepEqual(stations.map((s) => s.index), [0,1,2]);
assert.equal(stations[1].type, 'personal');
assert.equal(stations[1].commentary, 'My aside');
assert.match(stations[2].route, /^resume\/career-2\//);
assert.deepEqual(journeySections({}), []);

const html = renderEditorialSpread({ blocks: [{ type:'heading',text:'Title <script>' }, { type:'text',text:'Every paragraph survives.' }, { type:'quote',text:'A real quotation',by:'Source' }, { type:'stat',value:'42%',label:'Share' }, { type:'figure',src:'/image.png',alt:'A figure',caption:'A caption' }] }, { title:'Project',index:1,total:4 });
for (const text of ['Title &lt;script&gt;', 'Every paragraph survives.', 'A real quotation', '42%', '/image.png', 'A caption', '02 / 04']) assert.ok(html.includes(text), text);
assert.ok(!html.includes('<script>'));
for (const box of [{x:100,y:200,w:180,h:1500},{x:20,y:30,w:2400,h:180}]) {
  const pages = layoutEditorialPages(8,box);
  for (const page of pages) { assert.ok(Math.abs(page.w/page.h-1.4)<0.0001); assert.ok(page.x>=box.x && page.y>=box.y && page.x+page.w<=box.x+box.w+0.001 && page.y+page.h<=box.y+box.h+0.001); }
}

const source = '# My work\n\nIntroduction with [a link](https://example.org).\n\nFINDINGS\n## Evidence\n\n**Bold** and ![Image](/photo.png "Caption").\n\n## A detour\n\nText stays intact.';
const model = partitionDocument(source);
assert.equal(model.parts.length, 2);
assert.ok(model.parts[0].markdown.startsWith('FINDINGS\n## Evidence'));
model.parts.reverse();
const reordered = joinDocument(model);
assert.ok(reordered.indexOf('## A detour') < reordered.indexOf('## Evidence'));
assert.ok(reordered.includes('[a link](https://example.org)'));
assert.ok(reordered.includes('**Bold** and ![Image](/photo.png "Caption").'));
assert.throws(() => partitionDocument(''), /empty/);
assert.throws(() => validateDraft({slug:'../bad'}), /URL name/);

const root = await mkdtemp(join(tmpdir(), 'hocomnia-studio-'));
try {
  const data = { slug:'my-work',title:'My work',markdown:reordered,format:'deck',words:150 };
  const result = await saveStudioDraft(root, data);
  assert.equal(result.draft, true);
  const saved = await readFile(join(root,result.path),'utf8');
  assert.match(saved, /draft: true/);
  assert.ok(saved.indexOf('## A detour') < saved.indexOf('## Evidence'));
  await assert.rejects(saveStudioDraft(root,data), /already exists/);
  assert.equal(await readFile(join(root,result.path),'utf8'), saved);
} finally { await rm(root,{recursive:true,force:true}); }
console.log('ok unique stations, editorial content, source reordering, draft validation and exclusive saving');
