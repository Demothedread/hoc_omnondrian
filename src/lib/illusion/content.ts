/**
 * illusion/content.ts — CMS adapter for the illusion kit
 * ---------------------------------------------------------------------------
 * Same pattern as the site's existing content.ts: pages call one function
 * and never know which CMS is behind it. Merge this into that adapter, or
 * import it alongside.
 *
 * Default: Keystatic (git-based, no-code editing UI at /keystatic, content
 * stored as JSON in the repo, so it versions with the site).
 * Always falls back to defaults, so a missing or malformed entry can never
 * break the page.
 */
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../../keystatic.config';
import { mergeConfig } from './config.js';

export type IllusionConfig = ReturnType<typeof mergeConfig>;

export async function getIllusionConfig(): Promise<IllusionConfig> {
  try {
    const reader = createReader(process.cwd(), keystaticConfig);
    const entry = await reader.singletons.illusion.read();
    return mergeConfig(entry ?? {});
  } catch (error) {
    console.warn('[illusion] Using defaults; could not read CMS entry.', error);
    return mergeConfig({});
  }
}

/* ---------------------------------------------------------------------------
   OPTION: Sanity instead of Keystatic
   ---------------------------------------------------------------------------
   import { sanityClient } from 'sanity:client';
   export async function getIllusionConfig() {
     const entry = await sanityClient.fetch('*[_type == "illusion"][0]');
     return mergeConfig(entry ?? {});
   }
   The Sanity document type can be generated from SCHEMA exactly the way
   keystatic.illusion.ts does it below (select → string with options.list,
   range → number with min/max validation, toggle → boolean, text → string).
--------------------------------------------------------------------------- */
