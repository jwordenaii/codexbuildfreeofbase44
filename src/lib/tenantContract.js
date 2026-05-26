import { z } from 'zod';
import siteFactoryManifest from '@/config/siteFactoryManifest.json';

const marketGeoSchema = z
  .object({
    region: z.string().optional(),
    placename: z.string().optional(),
    position: z.string().optional(),
    icbm: z.string().optional(),
  })
  .partial();

const marketSchema = z
  .object({
    marketName: z.string().optional(),
    primaryRegion: z.string().optional(),
    primaryMetro: z.string().optional(),
    heroKicker: z.string().optional(),
    heroHeadline: z.string().optional(),
    heroBody: z.string().optional(),
    ctaLabel: z.string().optional(),
    phoneDisplay: z.string().optional(),
    proofHeadline: z.string().optional(),
    geo: marketGeoSchema.optional(),
  })
  .partial();

const profileSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  canonicalUrl: z.string().url(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  routeMode: z.string().optional(),
  enableChatWidget: z.boolean().optional(),
  market: marketSchema.optional(),
});

const tenantManifestSchema = z.object({
  profiles: z.array(profileSchema),
  hostnames: z.record(z.string(), z.string()),
});

const fallbackManifest = {
  profiles: [
    {
      key: 'jworden',
      label: 'J. Worden Asphalt Paving',
      canonicalUrl: 'https://www.jwordenasphaltpaving.com',
      routeMode: 'full-site',
      enableChatWidget: true,
    },
  ],
  hostnames: {
    'www.jwordenasphaltpaving.com': 'jworden',
    'jwordenasphaltpaving.com': 'jworden',
  },
};

const parsedManifest = tenantManifestSchema.safeParse(siteFactoryManifest);

if (!parsedManifest.success) {
  // Keep runtime resilient in production builds while surfacing contract drift in console.
  // The deploy gate script enforces strict validation in CI.
  console.warn('[tenant-contract] Manifest validation failed, using fallback manifest', parsedManifest.error?.issues || []);
}

const manifest = parsedManifest.success ? parsedManifest.data : fallbackManifest;

const profilesByKey = Object.fromEntries(manifest.profiles.map((p) => [p.key.toLowerCase(), p]));
const hostnames = Object.fromEntries(
  Object.entries(manifest.hostnames || {}).map(([host, tenant]) => [String(host).toLowerCase(), String(tenant).toLowerCase()]),
);

export const DEFAULT_TENANT = 'jworden';

export function getTenantByKey(key) {
  if (!key) return profilesByKey[DEFAULT_TENANT] || null;
  return profilesByKey[String(key).toLowerCase()] || null;
}

export function getTenantForHost(hostname) {
  if (!hostname) return getTenantByKey(DEFAULT_TENANT);
  const tenantKey = hostnames[String(hostname).toLowerCase()];
  return getTenantByKey(tenantKey || DEFAULT_TENANT);
}

export function getTenantForCurrentHost() {
  if (typeof window === 'undefined') return getTenantByKey(DEFAULT_TENANT);
  return getTenantForHost(window.location.hostname);
}

export function getAllTenantKeys() {
  return Object.keys(profilesByKey);
}

export function getHostTenantMap() {
  return { ...hostnames };
}
