// authorityContent.js — Read-side helper for the J. Worden | Authority engine.
//
// The build-time generator (scripts/ai-authority-factory.mjs) writes
// per-tenant JSON cache files into src/generated/. This module exposes a
// single getter that components use to render the cached "Verified Proof"
// text into city pages. Missing entries return null so pages degrade
// gracefully when content hasn't been generated for a city yet.

import jwordenAuthority from '@/generated/authorityContent.jworden.json';

const BY_TENANT = {
  jworden: jwordenAuthority,
};

const DEFAULT_TENANT = 'jworden';

/**
 * Return the cached Authority entry for a city slug, or null if not generated.
 *
 * @param {string} slug    e.g. 'richmond-va'
 * @param {string} [tenant] site-factory profile key (default 'jworden')
 * @returns {object|null}
 */
export function getAuthorityFor(slug, tenant = DEFAULT_TENANT) {
  if (!slug) return null;
  const table = BY_TENANT[tenant] || BY_TENANT[DEFAULT_TENANT] || {};
  const entry = table[slug];
  if (!entry || !entry.verified_content) return null;
  return entry;
}
