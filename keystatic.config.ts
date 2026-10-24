// DESCRIPTION: Declares the no-code portfolio collections and editable journey/host fields.
// INPUTS: Local content files or configured GitHub repository storage.
// OUTPUTS: Keystatic forms for projects, pages, stations and motion settings.
// DEPENDENCIES: Keystatic core and local illusion/shot schemas.
/**
 * keystatic.config.ts — the no-code CMS
 * ---------------------------------------------------------------------------
 * Open http://localhost:4321/keystatic while `npm run dev` is running.
 * Everything you edit is saved as files in src/content/ (commit them).
 * For editing on the live site, see "Editing online" in README.md.
 *
 *   Projects   write a project like a report; it becomes a presentation
 *              (headings → slides, labels, figures, quotes, images), or
 *              build slides by hand
 *   Posts      the blog
 *   Shots      camera choreography for the map
 *   Gallery    photographs
 *   About, Resumé
 *   Illusions, Cosmos  look and motion settings
 */
import { config, collection, singleton, fields } from '@keystatic/core';
import { illusionSingleton, cosmosSingleton } from './keystatic.illusion';
import { shotsCollection } from './keystatic.shots';

const storage = process.env.KEYSTATIC_GITHUB_REPO
  ? { kind: 'github' as const, repo: process.env.KEYSTATIC_GITHUB_REPO as `${string}/${string}` }
  : { kind: 'local' as const };

const tone = (label = 'Colour') => fields.select({
  label,
  options: [
    { label: 'Let the composition decide', value: 'auto' },
    { label: 'Paper', value: 'paper' }, { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' }, { label: 'Yellow', value: 'yellow' },
  ],
  defaultValue: 'auto',
});
const weight = fields.number({ label: 'Weight', description: 'Share of the slide. 1 is normal, 2 is twice the room.', defaultValue: 1, validation: { min: 0.2, max: 4 } });
const projectImages = { directory: 'public/images/projects', publicPath: '/images/projects/' };

const projects = collection({
  label: 'Projects',
  slugField: 'title',
  path: 'src/content/projects/*',
  format: { contentField: 'content' },
  entryLayout: 'content',
  columns: ['kind', 'format'],
  schema: {
    title: fields.slug({ name: { label: 'Title' } }),
    kind: fields.text({ label: 'Kind', description: 'Shown above the title, e.g. Presentation or Report.', defaultValue: 'Presentation' }),
    draft: fields.checkbox({ label: 'Draft (hidden from the park)', defaultValue: false }),
    format: fields.select({ label: 'Opens as', options: [{ label: 'Presentation (slides)', value: 'deck' }, { label: 'Report (long form)', value: 'report' }], defaultValue: 'deck' }),
    summary: fields.text({ label: 'One-line summary', description: 'Leave empty to use the first paragraph.', multiline: true }),
    source: fields.select({
      label: 'Build slides from',
      description: 'The document: headings become slides, short capitalised lines become labels, figures like "Revenue: 34%" become big numbers, quotes and images keep their roles. Check the result at /projects/<name>/outline.',
      options: [{ label: 'The document below (automatic)', value: 'document' }, { label: 'Slides built by hand (below the document)', value: 'slides' }],
      defaultValue: 'document',
    }),
    maxWords: fields.integer({ label: 'Words per slide', description: 'A section longer than this continues on another slide.', defaultValue: 150, validation: { min: 40, max: 400 } }),
    weight: fields.number({ label: 'Weight on the Projects page', defaultValue: 1, validation: { min: 0.5, max: 3 } }),
    order: fields.integer({ label: 'Order', defaultValue: 0 }),
    content: fields.markdoc({
      label: 'Document',
      description: 'Write it like a report. # Title, ## Sections, ### Subsections, > quotes, images, lists, and "Label: number" lines.',
      options: { image: projectImages },
    }),
    slides: fields.array(
      fields.object({
        blocks: fields.blocks({
          heading: { label: 'Heading', schema: fields.object({ text: fields.text({ label: 'Text' }), label: fields.text({ label: 'Small label above' }), weight, tone: tone() }) },
          text: { label: 'Text', schema: fields.object({ heading: fields.text({ label: 'Subheading' }), text: fields.text({ label: 'Text', multiline: true }), weight, tone: tone() }) },
          stat: { label: 'Big number', schema: fields.object({ value: fields.text({ label: 'Number' }), label: fields.text({ label: 'What it measures' }), weight, tone: tone() }) },
          quote: { label: 'Quote', schema: fields.object({ text: fields.text({ label: 'Quote', multiline: true }), by: fields.text({ label: 'Source' }), weight, tone: tone() }) },
          figure: { label: 'Image', schema: fields.object({ src: fields.image({ label: 'Image', ...projectImages }), alt: fields.text({ label: 'Alt text' }), caption: fields.text({ label: 'Caption' }), weight, tone: tone() }) },
        }, { label: 'Blocks' }),
      }),
      { label: 'Slides built by hand', description: 'Only used when "Build slides from" is set to slides.', itemLabel: (p) => `Slide (${p.fields.blocks.elements.length} blocks)` },
    ),
  },
});

const posts = collection({
  label: 'Posts',
  slugField: 'title',
  path: 'src/content/posts/*',
  format: { contentField: 'content' },
  entryLayout: 'content',
  columns: ['date'],
  schema: {
    title: fields.slug({ name: { label: 'Title' } }),
    date: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
    summary: fields.text({ label: 'Summary', multiline: true }),
    tone: fields.select({ label: 'Colour', options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }, { label: 'Yellow', value: 'yellow' }], defaultValue: 'red' }),
    draft: fields.checkbox({ label: 'Draft (hidden)', defaultValue: false }),
    content: fields.markdoc({ label: 'Body', options: { image: { directory: 'public/images/posts', publicPath: '/images/posts/' } } }),
  },
});

const gallery = singleton({
  label: 'Gallery',
  path: 'src/content/gallery/',
  format: { data: 'json' },
  schema: {
    photos: fields.array(
      fields.object({
        image: fields.image({ label: 'Photo', directory: 'public/images/gallery', publicPath: '/images/gallery/' }),
        alt: fields.text({ label: 'Alt text', validation: { length: { min: 1 } } }),
        caption: fields.text({ label: 'Caption' }),
        weight: fields.number({ label: 'Weight', description: 'Larger numbers get a bigger field.', defaultValue: 1, validation: { min: 0.5, max: 3 } }),
      }),
      { label: 'Photos', itemLabel: (p) => p.fields.alt.value || 'Photo' },
    ),
  },
});

const about = singleton({
  label: 'About',
  path: 'src/content/about/',
  format: { contentField: 'content' },
  entryLayout: 'content',
  schema: {
    title: fields.text({ label: 'Title', defaultValue: 'About' }),
    summary: fields.text({ label: 'Summary', multiline: true }),
    greeting: fields.text({ label: 'Guide greeting', description: 'The illustrated host greets visitors with this message.', multiline: true }),
    avatar: fields.image({ label: 'Guide illustration (optional replacement)', directory: 'public/images/host', publicPath: '/images/host/' }),
    content: fields.markdoc({ label: 'Body' }),
  },
});

const resume = singleton({
  label: 'Resumé',
  path: 'src/content/resume/',
  format: { data: 'json' },
  schema: {
    summary: fields.text({ label: 'Summary', multiline: true }),
    sections: fields.array(
      fields.object({
        heading: fields.text({ label: 'Section', description: 'e.g. Experience, Education, Skills' }),
        id: fields.text({ label: 'Permanent section URL', description: 'Keep this unique and unchanged when renaming or reordering sections.' }),
        entries: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            id: fields.text({ label: 'Permanent station URL', description: 'Use a unique short name within this section. Keep it unchanged when editing or reordering.' }),
            org: fields.text({ label: 'Organisation' }),
            dates: fields.text({ label: 'Dates' }),
            note: fields.text({ label: 'Note', multiline: true }),
            type: fields.select({ label: 'Station type', defaultValue: 'professional', options: [{ label: 'Professional', value: 'professional' }, { label: 'Personal', value: 'personal' }] }),
            commentary: fields.text({ label: 'Guide commentary', description: 'A short aside spoken by the illustrated host at this station.', multiline: true }),
            destination: fields.text({ label: 'Related destination', description: 'Optional park path, e.g. gallery or projects/tesla. No leading slash needed.' }),
          }),
          { label: 'Entries', itemLabel: (p) => p.fields.title.value || 'Entry' },
        ),
      }),
      { label: 'Sections', itemLabel: (p) => p.fields.heading.value || 'Section' },
    ),
  },
});

export default config({
  storage,
  ui: {
    brand: { name: 'Hoc omnia nihil est' },
    navigation: {
      Writing: ['projects', 'posts'],
      Pages: ['gallery', 'about', 'resume'],
      Motion: ['shots', 'cosmos', 'illusion'],
    },
  },
  collections: { projects, posts, shots: shotsCollection },
  singletons: { gallery, about, resume, illusion: illusionSingleton, cosmos: cosmosSingleton },
});
