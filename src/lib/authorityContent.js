// authorityContent.js — Read-side helper for the J. Worden | Authority engine.
//
// The build-time generator (scripts/ai-authority-factory.mjs) writes
// per-tenant JSON cache files into src/generated/. This module exposes a
// single getter that components use to render the cached "Verified Proof"
// text into city pages. Missing entries return null so pages degrade
// gracefully when content hasn't been generated for a city yet.

import { DEFAULT_TENANT, getTenantForCurrentHost } from '@/lib/tenantContract';

const AUTHORITY_MODULES = import.meta.glob('/src/generated/authorityContent.*.json', {
  eager: true,
});

const BY_TENANT = Object.entries(AUTHORITY_MODULES).reduce((acc, [path, mod]) => {
  const match = path.match(/authorityContent\.([a-z0-9_-]+)\.json$/i);
  if (!match) return acc;
  const tenant = match[1].toLowerCase();
  acc[tenant] = mod?.default || {};
  return acc;
}, {});

function resolveTenant(explicitTenant) {
  if (explicitTenant) return String(explicitTenant).toLowerCase();
  if (typeof window === 'undefined') return DEFAULT_TENANT;
  return getTenantForCurrentHost()?.key || DEFAULT_TENANT;
}

/**
 * Return the cached Authority entry for a city slug, or null if not generated.
 *
 * @param {string} slug    e.g. 'richmond-va'
 * @param {string} [tenant] site-factory profile key (host-inferred when omitted)
 * @returns {object|null}
 */
export function getAuthorityFor(slug, tenant) {
  if (!slug) return null;
  const resolvedTenant = resolveTenant(tenant);
  const table = BY_TENANT[resolvedTenant] || {};
  const entry = table[slug];
  if (!entry || !entry.verified_content) return null;
  return entry;
}
