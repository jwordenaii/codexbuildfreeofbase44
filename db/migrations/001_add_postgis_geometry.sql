-- ── 001_add_postgis_geometry.sql ──────────────────────────────────────────────
-- PostGIS upgrade migration for JWordenAI.
--
-- Run this AFTER the initial tables are created by SQLAlchemy's create_all()
-- to add native GEOMETRY columns and GIST spatial indexes to project_sites
-- and permit_leads.
--
-- This migration is idempotent (uses IF NOT EXISTS / DO NOTHING guards).
--
-- Run manually:
--   psql $DATABASE_URL -f db/migrations/001_add_postgis_geometry.sql
--
-- Or place in docker-entrypoint-initdb.d/ to auto-run on first DB init
-- (the PostGIS Docker image runs all .sql files in that directory).

-- Enable PostGIS extension (requires the postgis/postgis Docker image or
-- the postgis extension installed on your RDS/Cloud SQL instance).
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── project_sites: add GEOMETRY column + GIST index ──────────────────────────

ALTER TABLE project_sites
    ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Backfill from existing float lat/lng columns
UPDATE project_sites
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

-- GIST spatial index for sub-second ST_DWithin radius queries
CREATE INDEX IF NOT EXISTS idx_project_sites_geom
    ON project_sites USING GIST (geom);

-- Optional: add a polygon geometry column for the leaflet-draw polygons
ALTER TABLE project_sites
    ADD COLUMN IF NOT EXISTS boundary GEOMETRY(MULTIPOLYGON, 4326);

CREATE INDEX IF NOT EXISTS idx_project_sites_boundary
    ON project_sites USING GIST (boundary);


-- ── permit_leads: add GEOMETRY column + GIST index ───────────────────────────

ALTER TABLE permit_leads
    ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

UPDATE permit_leads
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

CREATE INDEX IF NOT EXISTS idx_permit_leads_geom
    ON permit_leads USING GIST (geom);


-- ── Example spatial query: all permit leads within 20 miles of Richmond ───────
-- Uncomment and run to verify the indexes are working:
--
-- SELECT id, property_address, permit_type, priority_label,
--        ST_Distance(
--            geom::geography,
--            ST_SetSRID(ST_MakePoint(-77.4360, 37.5407), 4326)::geography
--        ) / 1609.34 AS distance_miles
-- FROM permit_leads
-- WHERE ST_DWithin(
--     geom::geography,
--     ST_SetSRID(ST_MakePoint(-77.4360, 37.5407), 4326)::geography,
--     20 * 1609.34   -- 20 miles in meters
-- )
-- ORDER BY distance_miles;
