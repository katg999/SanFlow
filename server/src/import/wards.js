// Import real ward / division boundaries from OpenStreetMap (admin_level 8) for each region.
import osmtogeojson from 'osmtogeojson';
import { pool } from '../db.js';
import { overpass } from './overpass.js';
import { REGIONS, bboxStr } from './regions.js';

const clean = (name) => name.replace(/\s+(ward|division|sublocation)$/i, '').trim();

export async function importWards({ log = console.log } = {}) {
  const summary = [];
  for (const region of REGIONS) {
    log(`Wards — ${region.city}`);
    const countyData = await overpass(
      `[out:json][timeout:120];rel["boundary"="administrative"]["admin_level"="4"]["name"="${region.countyName}"](${bboxStr(region)});out geom;`, { log });
    const county = osmtogeojson(countyData).features.find((f) => /polygon/i.test(f.geometry.type));
    if (!county) throw new Error(`Could not find the ${region.countyName} county boundary in OSM`);

    const data = await overpass(
      `[out:json][timeout:180];rel["boundary"="administrative"]["admin_level"="${region.wardLevel}"](${bboxStr(region)});out geom;`, { log });
    const features = osmtogeojson(data).features;
    let inserted = 0;
    let outside = 0;
    const skipped = [];

    for (const f of features) {
      const name = f.properties?.tags?.name ?? f.properties?.name;
      const osmId = f.id ?? `relation/${f.properties?.id}`; // osmtogeojson ids look like "relation/123"
      if (!name || !/polygon/i.test(f.geometry.type)) {
        skipped.push(`${name ?? osmId}: ${f.geometry.type} (broken or unnamed boundary)`);
        continue;
      }
      const { rows } = await pool.query(
        `WITH g AS (
           SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3)) AS geom
         )
         INSERT INTO wards(id, name, city, center, boundary, osm_id, admin_level)
         SELECT $2, $3, $4, ST_PointOnSurface(g.geom)::geography, g.geom::geography, $5, $6 FROM g
          WHERE ST_Covers(ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), ST_PointOnSurface(g.geom))
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, boundary = EXCLUDED.boundary, center = EXCLUDED.center
         RETURNING id`,
        [JSON.stringify(f.geometry), `ward-${osmId.replace('/', '-')}`, clean(name), region.city, osmId, region.wardLevel, JSON.stringify(county.geometry)]);
      if (rows.length) inserted += 1;
      else outside += 1;
    }
    log(`  ${inserted} wards inside ${region.countyName} (${outside} outside the county ignored, ${skipped.length} skipped)`);
    skipped.forEach((s) => log(`  skipped: ${s}`));
    summary.push({ city: region.city, wards: inserted, skipped: skipped.length });
  }
  return summary;
}
