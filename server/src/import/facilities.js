// Import real toilets, water points, waste points and health facilities from OpenStreetMap.
// Safe to re-run: only tag-derived fields are refreshed. Status, ratings, ownership and anything a person has
// done (reports, confirmations) are never overwritten, and rows that vanish from OSM are flagged, not deleted.
import { pool, tx } from '../db.js';
import { overpass } from './overpass.js';
import { REGIONS, bboxStr } from './regions.js';
import { mapElement } from '../lib/osmTags.js';

const QUERIES = {
  toilet: ['amenity"="toilets'],
  water: ['amenity"="drinking_water', 'amenity"="water_point', 'man_made"="water_well', 'man_made"="water_tap'],
  waste: ['amenity"="waste_disposal', 'amenity"="recycling', 'amenity"="waste_transfer_station', 'amenity"="sanitary_dump_station'],
  health: ['amenity"="clinic', 'amenity"="hospital', 'amenity"="pharmacy', 'amenity"="doctors'],
};

const buildQuery = (filters, bbox) =>
  `[out:json][timeout:150];(${filters.map((f) => `node["${f}"](${bbox});way["${f}"](${bbox});`).join('')});out center tags;`;

const UPSERT = `
INSERT INTO facilities(id, category, name, area, country, geom, hours, fee, amenities, description, access, source, osm_tags, osm_seen_at, osm_gone)
SELECT r.id, r.category, r.name, r.area, r.country, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography, r.hours, r.fee,
       CASE WHEN r.amenities IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(r.amenities)) END,
       r.description, r.access, 'osm', r.tags, now(), false
  FROM jsonb_to_recordset($1::jsonb) AS r(id text, category text, name text, area text, country text, lat float8, lng float8, hours text, fee int, amenities jsonb, description text, access text, tags jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, geom = EXCLUDED.geom, access = EXCLUDED.access, osm_tags = EXCLUDED.osm_tags, osm_seen_at = now(), osm_gone = false,
  -- values an operator has set (facility is owned) are theirs; otherwise OSM is the source
  hours = CASE WHEN facilities.owner_org_id IS NULL THEN EXCLUDED.hours ELSE facilities.hours END,
  fee = CASE WHEN facilities.owner_org_id IS NULL THEN EXCLUDED.fee ELSE facilities.fee END,
  amenities = CASE WHEN facilities.owner_org_id IS NULL THEN EXCLUDED.amenities ELSE facilities.amenities END,
  description = CASE WHEN facilities.owner_org_id IS NULL THEN EXCLUDED.description ELSE facilities.description END`;

export async function importFacilities({ regions = REGIONS, log = console.log, fetchQuery = overpass } = {}) {
  // Use the database's clock for both sides of every comparison — the host and a Docker VM can drift apart.
  const { rows: [{ started }] } = await pool.query('SELECT clock_timestamp() AS started');
  const startedAt = started;
  const counts = {};
  const skips = {};

  for (const region of regions) {
    counts[region.key] = {};
    for (const [category, filters] of Object.entries(QUERIES)) {
      const data = await fetchQuery(buildQuery(filters, bboxStr(region)), { log });
      const records = [];
      const seen = new Set();
      for (const el of data.elements ?? []) {
        const rec = mapElement(el, region);
        if (rec.skip) {
          skips[rec.skip] = (skips[rec.skip] ?? 0) + 1;
          continue;
        }
        if (rec.category !== category || seen.has(rec.id)) continue;
        seen.add(rec.id);
        records.push(rec);
      }
      for (let i = 0; i < records.length; i += 1000) {
        await pool.query(UPSERT, [JSON.stringify(records.slice(i, i + 1000))]);
      }
      counts[region.key][category] = records.length;
      log(`  ${region.city} ${category}: ${records.length}`);
    }
  }

  await tx(async (c) => {
    await c.query("INSERT INTO facility_state(facility_id) SELECT id FROM facilities WHERE source = 'osm' ON CONFLICT DO NOTHING");
    // Locate each facility in a real ward. Unnamed OSM features get "<type>, <ward>" so lists aren't 100 identical rows.
    await c.query(
      `UPDATE facilities f SET area = w.name || ', ' || w.city,
              name = CASE WHEN f.osm_tags->>'name' IS NULL THEN f.name || ', ' || w.name ELSE f.name END
         FROM wards w
        WHERE f.source = 'osm' AND f.osm_seen_at >= $1 AND w.boundary IS NOT NULL AND ST_Covers(w.boundary, f.geom)`, [startedAt]);
    // Anything in an imported region that OSM no longer lists is flagged (kept for its history, hidden from the map).
    for (const region of regions) {
      const [s, w, n, e] = region.bbox;
      await c.query(
        `UPDATE facilities SET osm_gone = true WHERE source = 'osm' AND osm_seen_at < $1
            AND ST_Intersects(geom, ST_MakeEnvelope($3, $2, $5, $4, 4326)::geography)`, [startedAt, s, w, n, e]);
    }
  });

  const { rows } = await pool.query(
    "SELECT category, count(*)::int AS n FROM facilities WHERE source = 'osm' AND NOT osm_gone GROUP BY category ORDER BY category");
  log(`  skipped: ${JSON.stringify(skips)}`);
  return { counts, skips, totals: rows };
}
