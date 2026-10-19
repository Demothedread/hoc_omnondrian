/**
 * keystatic.illusion.ts — the no-code editing form for illusions
 * ---------------------------------------------------------------------------
 * Generated from SCHEMA in src/lib/illusion/config.js, so the CMS form and
 * the admin panel can never drift apart. Add it to keystatic.config.ts:
 *
 *   import { illusionSingleton, cosmosSingleton } from './keystatic.illusion';
 *   export default config({
 *     storage: { kind: 'local' },          // OPTION: { kind: 'github', repo: 'owner/name' }
 *     singletons: { illusion: illusionSingleton, cosmos: cosmosSingleton },
 *     // ...existing collections
 *   });
 *
 * Editors then change the published look at /keystatic, with every field's
 * help text shown as its description.
 */
import { fields, singleton } from '@keystatic/core';
import { SCHEMA } from './src/lib/illusion/config.js';
import { COSMOS_SCHEMA } from './src/lib/cosmos/schema.js';

// The schema is plain JS, so its `type` is only a string there. This is the shape
// each `type` promises (see "Field shape" in config.js).
type Field = { key: string; label: string; help?: string } & (
  | { type: 'select'; options: [string, string][]; default: string }
  | { type: 'range'; min: number; max: number; default: number }
  | { type: 'toggle'; default: boolean }
  | { type: 'text'; default: string }
);

function toKeystaticField(f: Field) {
  const base = { label: f.label, description: f.help };
  switch (f.type) {
    case 'select':
      return fields.select({
        ...base,
        options: f.options.map(([value, label]) => ({ value, label })),
        defaultValue: f.default,
      });
    case 'range':
      return fields.number({ ...base, defaultValue: f.default, validation: { min: f.min, max: f.max } });
    case 'toggle':
      return fields.checkbox({ ...base, defaultValue: f.default });
    case 'text':
    default:
      return fields.text({ ...base, defaultValue: f.default });
  }
}

// The reduced-motion preview is an editing aid, not a published setting.
const EDITOR_ONLY = new Set(['previewReducedMotion']);

function schemaFields(schema: readonly { fields: readonly object[] }[]) {
  return Object.fromEntries(
    schema.flatMap((section) => section.fields as Field[])
      .filter((f) => !EDITOR_ONLY.has(f.key))
      .map((f) => [f.key, toKeystaticField(f)]),
  );
}

export const illusionSingleton = singleton({
  label: 'Illusions',
  path: 'src/content/illusion/',
  format: { data: 'json' },
  schema: schemaFields(SCHEMA),
});

/** Settings for the cosmos world: flights, tour, focus, title card, black hole. */
export const cosmosSingleton = singleton({
  label: 'Cosmos',
  path: 'src/content/cosmos/',
  format: { data: 'json' },
  schema: schemaFields(COSMOS_SCHEMA),
});
