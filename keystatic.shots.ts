/**
 * keystatic.shots.ts — the "Shots" collection: camera choreography in the CMS
 * ---------------------------------------------------------------------------
 * Add to keystatic.config.ts:
 *   import { shotsCollection } from './keystatic.shots';
 *   collections: { shots: shotsCollection, ...yourCollections },
 * The slug is the shot id (used by data-shot="id" and cosmos.play('id')).
 */
import { collection, fields } from '@keystatic/core';

export const shotsCollection = collection({
  label: 'Shots',
  slugField: 'name',
  path: 'src/content/shots/*',
  format: { data: 'json' },
  schema: {
    name: fields.slug({ name: { label: 'Name', description: 'Also the id for data-shot="…" buttons.' } }),
    trigger: fields.select({
      label: 'Plays when',
      options: [
        { label: 'A route is clicked', value: 'click' },
        { label: 'The page opens', value: 'load' },
        { label: 'Nobody has touched anything for a while', value: 'idle' },
        { label: 'Only from a button or code', value: 'manual' },
      ],
      defaultValue: 'click',
    }),
    route: fields.text({ label: 'Route clicked', description: 'For "a route is clicked", e.g. projects or projects/cosmos.' }),
    idleSeconds: fields.number({ label: 'Idle seconds', defaultValue: 60, validation: { min: 3, max: 600 } }),
    loop: fields.checkbox({ label: 'Loop', defaultValue: false }),
    steps: fields.array(
      fields.object({
        to: fields.text({ label: 'Go to', description: 'A route (projects/cosmos), "overview", or a view "x, y, w" (Alt+Shift+V copies the current one).' }),
        fit: fields.select({ label: 'Arrival', options: [{ label: 'Default', value: '' }, { label: 'Fill the screen', value: 'fill' }, { label: 'Framed', value: 'frame' }], defaultValue: '' }),
        speed: fields.number({ label: 'Speed', defaultValue: 1, validation: { min: 0.1, max: 5 } }),
        ease: fields.select({ label: 'Easing', options: [{ label: 'Default', value: '' }, { label: 'Gentle', value: 'sine' }, { label: 'Firm', value: 'cubic' }, { label: 'Snap and glide', value: 'expo' }, { label: 'Constant', value: 'linear' }], defaultValue: '' }),
        hold: fields.number({ label: 'Hold (s)', description: 'Ken Burns drift after arriving. 0 moves straight on.', defaultValue: 0, validation: { min: 0, max: 60 } }),
        push: fields.number({ label: 'Push-in', description: '1 = still, 1.1 = 10% closer over the hold.', defaultValue: 1, validation: { min: 1, max: 2 } }),
        panX: fields.number({ label: 'Drift sideways', defaultValue: 0, validation: { min: -1, max: 1 } }),
        panY: fields.number({ label: 'Drift down', defaultValue: 0, validation: { min: -1, max: 1 } }),
        focus: fields.select({ label: 'Focus on arrival', options: [{ label: 'Rack to title, then map', value: 'map' }, { label: 'Stay on title', value: 'near' }], defaultValue: 'map' }),
        title: fields.text({ label: 'Title card override' }),
      }),
      { label: 'Steps', itemLabel: (p) => `${p.fields.to.value || '(nowhere)'}${p.fields.hold.value ? ` · hold ${p.fields.hold.value}s` : ''}` },
    ),
  },
});
