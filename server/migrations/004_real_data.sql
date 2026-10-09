-- Real-data support: OSM provenance on facilities, real ward polygons + sourced population.
ALTER TABLE facilities ADD COLUMN osm_tags jsonb;
ALTER TABLE facilities ADD COLUMN osm_seen_at timestamptz;
ALTER TABLE facilities ADD COLUMN osm_gone boolean NOT NULL DEFAULT false;   -- no longer in OpenStreetMap (kept for history)
-- 'customers' = toilets/water for customers only: shown, but never recommended as a public toilet.
ALTER TABLE facilities ADD COLUMN access text NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'customers'));
CREATE INDEX facilities_visible_idx ON facilities (category) WHERE NOT osm_gone;

ALTER TABLE wards ALTER COLUMN radius_m DROP NOT NULL;
ALTER TABLE wards ALTER COLUMN population DROP NOT NULL;          -- NULL = not known yet
ALTER TABLE wards ALTER COLUMN boundary TYPE geography(MultiPolygon, 4326) USING ST_Multi(boundary::geometry)::geography;
ALTER TABLE wards ADD COLUMN osm_id text UNIQUE;
ALTER TABLE wards ADD COLUMN admin_level int;
ALTER TABLE wards ADD COLUMN population_source text;
ALTER TABLE wards ADD COLUMN population_year int;
ALTER TABLE wards ADD COLUMN population_updated_at timestamptz;
CREATE INDEX wards_boundary_idx ON wards USING GIST (boundary);
