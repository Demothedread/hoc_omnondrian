// node test/doc-to-deck.test.mjs — the document → presentation mapper
import assert from 'node:assert/strict';
import { documentToProject, matchFigure, isLabel, inferHeadings } from '../src/lib/site/doc-to-deck.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok', name); };

// --- Recognisers ----------------------------------------------------------
t('figures', () => {
  assert.deepEqual(matchFigure('Revenue growth: 34%'), { value: '34%', label: 'Revenue growth' });
  assert.deepEqual(matchFigure('**$1.2M** raised in the seed round'), { value: '$1.2M', label: 'raised in the seed round' });
  assert.deepEqual(matchFigure('12,400 riders surveyed'), { value: '12,400', label: 'riders surveyed' });
  assert.equal(matchFigure('2019 was the year everything changed.'), null, 'a year opening a sentence is not a figure');
  assert.deepEqual(matchFigure('Average stay: 74 min'), { value: '74 min', label: 'Average stay' }, 'units end at word boundaries');
  assert.deepEqual(matchFigure('Margin change: -6 pts'), { value: '-6 pts', label: 'Margin change' });
  assert.deepEqual(matchFigure('3 million riders'), null, 'a word after a bare small count is not a unit');
  assert.deepEqual(matchFigure('$4bn in new orders'), { value: '$4bn', label: 'in new orders' });
  assert.equal(matchFigure('3 reasons the plan worked'), null, 'a small bare count stays text');
  assert.equal(matchFigure('This is a long ordinary sentence with a number 42 somewhere in the middle of it, which should stay text.'), null);
});
t('labels', () => {
  assert.ok(isLabel('CASE STUDY'));
  assert.ok(isLabel('Part one:'));
  assert.ok(!isLabel('Context'));
  assert.ok(!isLabel('A longer line that is not a label'));
});

// --- Structured Markdown ---------------------------------------------------
const md = `# Tesla

How a pricing change moved demand across three markets.

Units delivered: 1.8M

CASE STUDY
## Context

The company cut prices twice in one quarter. Analysts disagreed about why.

### What changed
Two price cuts, eleven weeks apart.

## Findings

- Demand lift: 24%
- Margin change: -6 pts
- Markets affected: 3

> The cheapest car is the one already in the factory.
> — Analyst note

![Delivery chart](/images/projects/tesla-chart.png "Deliveries by quarter")

---

Closing thoughts with no heading.`;

t('markdown project', () => {
  const p = documentToProject(md);
  assert.equal(p.title, 'Tesla');
  assert.equal(p.summary, 'How a pricing change moved demand across three markets.');
  const [s1, s2, s3, s4] = p.slides;
  assert.equal(s1.blocks[0].type, 'heading');
  assert.equal(s1.blocks[0].title, true);
  assert.equal(s1.blocks[2].type, 'stat');
  assert.equal(s1.blocks[2].value, '1.8M');
  assert.equal(s2.blocks[0].text, 'Context');
  assert.equal(s2.blocks[0].label, 'CASE STUDY', 'label above the section heading');
  const titled = s2.blocks.find((b) => b.heading === 'What changed');
  assert.ok(titled && titled.type === 'text', 'subheading titles the next paragraph');
  assert.equal(s3.blocks[0].text, 'Findings');
  assert.deepEqual(s3.blocks.filter((b) => b.type === 'stat').map((b) => b.value), ['24%', '-6 pts', '3']);
  // the quote and figure overflow Findings (3 stats + quote = 4 blocks; the figure continues)
  const all = p.slides.flatMap((s) => s.blocks);
  const quote = all.find((b) => b.type === 'quote');
  assert.equal(quote.by, 'Analyst note');
  assert.ok(all.find((b) => b.type === 'figure' && b.caption === 'Deliveries by quarter'));
  assert.ok(p.slides.some((s) => s.blocks[0].text === 'Findings (continued)'), 'overflow continues the section');
  const last = p.slides[p.slides.length - 1];
  assert.equal(last.blocks[0].type, 'text', '--- starts an untitled slide');
  assert.ok(all.every((b) => b.rule), 'every block records its rule');
});

// --- Plain text, as pasted from Word ---------------------------------------
const word = `Hesperia, CA

A report on housing, water and the High Desert.

1. Background

Hesperia grew quickly in the 2000s. The water supply did not keep pace, and the city's plans changed twice.

1.1 Water

Most supply comes from groundwater. Recharge depends on the Mojave River.

Population: 100,000+

2. Recommendations

• Tie permits to recharge
• Publish the water budget yearly`;

t('inferred headings', () => {
  const md2 = inferHeadings(word);
  assert.match(md2, /^# Hesperia, CA$/m);
  assert.match(md2, /^## Background$/m);
  assert.match(md2, /^### Water$/m);
  assert.match(md2, /^## Recommendations$/m);
  assert.match(md2, /^- Tie permits to recharge$/m);
});
t('plain-text project', () => {
  const p = documentToProject(word);
  assert.equal(p.title, 'Hesperia, CA');
  const heads = p.slides.map((s) => s.blocks[0].text);
  assert.deepEqual(heads, ['Hesperia, CA', 'Background', 'Recommendations']);
  const bg = p.slides[1].blocks;
  assert.ok(bg.find((b) => b.heading === 'Water'), 'numbered subsection titles its paragraph');
  assert.ok(bg.find((b) => b.type === 'stat' && b.value === '100,000+'));
  assert.equal(p.slides[2].blocks[1].type, 'list');
});

// --- Long text splits and overflows ------------------------------------------
t('long paragraphs', () => {
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i + 1} explains one more detail of the method.`).join(' ');
  const p = documentToProject(`# T\n\n## Method\n\n${long}`, { maxWords: 150, chunkWords: 70 });
  const method = p.slides.filter((s) => s.blocks[0].text.startsWith('Method'));
  assert.ok(method.length >= 2, 'a long section continues');
  const texts = p.slides.flatMap((s) => s.blocks).filter((b) => b.type === 'text');
  assert.ok(texts.every((b) => b.text.split(/\s+/).length <= 70), 'no text block over 70 words');
  assert.ok(texts.every((b) => /[.]$/.test(b.text)), 'splits land on sentence ends');
});

t('no title in the text, title from the CMS', () => {
  const p = documentToProject('Some opening words.\n\n## Part\n\nBody.', { title: 'Common Party' });
  assert.equal(p.title, 'Common Party');
  assert.equal(p.slides[0].blocks[0].text, 'Common Party');
  assert.equal(p.slides[0].blocks[1].text, 'Some opening words.');
});

console.log(`\n${passed} passed`);
