// =====================================================================
// The Worden Standard — Neon Postgres thin wrapper
// Single source of truth for DB writes. Every netlify function/scheduled
// task that touches the signal store imports from here.
//
// Setup:
//   1. Create free Neon project at https://neon.tech (60 sec)
//   2. Copy connection string into Netlify env var DATABASE_URL
//   3. Apply db/migrations/0001_signal_store.sql to your branch
//
// Why @neondatabase/serverless: HTTP-pooled, sub-50ms cold start,
// no TCP keep-alive baggage, free tier compatible. The right driver
// for Netlify edge/lambda runtime.
// =====================================================================

import { neon } from '@neondatabase/serverless';
import type {
  SourceFetchResult,
  IngestRunSummary,
  PredictionRow,
} from '../types/signals.types';

const url = process.env.DATABASE_URL;

/**
 * Lazy init — only construct the SQL client when actually called.
 * Keeps cold-start cheap and lets the build run without DATABASE_URL set.
 */
function client() {
  if (!url) {
    throw new Error(
      'DATABASE_URL not set. Create Neon project at neon.tech and add to Netlify env vars.',
    );
  }
  return neon(url);
}

/** Returns true if DATABASE_URL is configured (for graceful degrade in stations). */
export function isPersistenceEnabled(): boolean {
  return Boolean(url);
}

/**
 * Insert one raw fetch result + its normalized facts in a single batch.
 * Idempotent on cache_key (signals_raw) and (metric, geo, observed_at) tuple
 * (signals_normalized).
 *
 * Returns the inserted signals_raw.id (or existing id if dedup hit).
 */
export async function ingestSourceResult<T>(
  result: SourceFetchResult<T>,
): Promise<bigint | null> {
  const sql = client();

  // Insert raw, ON CONFLICT do nothing (cache_key dedup)
  const rawRows = await sql`
    INSERT INTO signals_raw (source, endpoint, geo_fips, status, payload, cache_key)
    VALUES (${result.source}, ${result.endpoint}, ${result.geo ?? null},
            ${result.status}, ${JSON.stringify(result.payload)}::jsonb, ${result.cacheKey})
    ON CONFLICT (cache_key) DO UPDATE SET cache_key = EXCLUDED.cache_key
    RETURNING id
  `;
  const rawId = rawRows[0]?.id ? BigInt(rawRows[0].id as string | number) : null;

  // Upsert each normalized fact
  for (const n of result.normalized) {
    await sql`
      INSERT INTO signals_normalized (metric, geo_fips, observed_at, value, unit, source_id)
      VALUES (${n.metric}, ${n.geo}, ${n.observedAt}, ${n.value}, ${n.unit ?? null},
              ${rawId !== null ? rawId.toString() : null})
      ON CONFLICT (metric, geo_fips, observed_at)
      DO UPDATE SET value = EXCLUDED.value, ingested_at = now()
    `;
  }

  return rawId;
}

/**
 * Read most recent N observations of one metric for a geography.
 * Used by the fusion layer to compute z-scores against rolling baseline.
 */
export async function readMetricSeries(
  metric: string,
  geoFips: string,
  limitDays = 1825, // 5 years default
): Promise<Array<{ observedAt: string; value: number }>> {
  const sql = client();
  const rows = await sql`
    SELECT observed_at::text AS "observedAt", value::float AS value
    FROM signals_normalized
    WHERE metric = ${metric} AND geo_fips = ${geoFips}
    ORDER BY observed_at DESC
    LIMIT ${limitDays}
  `;
  return rows as Array<{ observedAt: string; value: number }>;
}

/**
 * Persist a prediction row (output of fusion models like WBP-v1).
 * Idempotent on (model, geo, horizon, generation date).
 */
export async function writePrediction(p: PredictionRow): Promise<void> {
  const sql = client();
  await sql`
    INSERT INTO predictions (model, geo_fips, horizon_days, score, components, narrative)
    VALUES (${p.model}, ${p.geoFips}, ${p.horizonDays}, ${p.score},
            ${JSON.stringify(p.components)}::jsonb, ${p.narrative ?? null})
    ON CONFLICT (model, geo_fips, horizon_days, tstz_to_date(generated_at))
    DO UPDATE SET score = EXCLUDED.score,
                  components = EXCLUDED.components,
                  narrative = EXCLUDED.narrative,
                  generated_at = now()
  `;
}

/** Read latest prediction for a (model, geo, horizon). */
export async function readLatestPrediction(
  model: string,
  geoFips: string,
  horizonDays: number,
): Promise<PredictionRow | null> {
  const sql = client();
  const rows = await sql`
    SELECT model, geo_fips AS "geoFips", horizon_days AS "horizonDays",
           score::float AS score, components, narrative
    FROM predictions
    WHERE model = ${model} AND geo_fips = ${geoFips} AND horizon_days = ${horizonDays}
    ORDER BY generated_at DESC
    LIMIT 1
  `;
  return (rows[0] as PredictionRow | undefined) ?? null;
}

/** Write the summary record for an ingest run (observability). */
export async function writeIngestRun(s: IngestRunSummary): Promise<void> {
  const sql = client();
  await sql`
    INSERT INTO ingest_runs
      (started_at, finished_at, sources_attempted, sources_succeeded,
       rows_raw, rows_normalized, error)
    VALUES
      (${s.startedAt}, ${s.finishedAt}, ${s.sourcesAttempted}, ${s.sourcesSucceeded},
       ${s.rowsRaw}, ${s.rowsNormalized}, ${s.error ?? null})
  `;
}
