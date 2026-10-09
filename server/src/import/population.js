// Ward population from WorldPop (https://www.worldpop.org, CC BY 4.0): "Global per country 2000-2020",
// 100 m resolution, summed over each ward polygon. These are MODELLED ESTIMATES, not census counts —
// the source is stored with every number so the UI can say so.
import { pool } from '../db.js';

const API = 'https://api.worldpop.org/v1';
export const POP_SOURCE = 'WorldPop 2020 (wpgppop, modelled estimate)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function worldpopTotal(geometry) {
  const body = new URLSearchParams({
    dataset: 'wpgppop',
    year: '2020',
    geojson: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] }),
    runasync: 'true',
  });
  const created = await fetch(`${API}/services/stats`, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
  const job = await created.json();
  if (!job.taskid) throw new Error(`WorldPop did not accept the request: ${JSON.stringify(job).slice(0, 200)}`);
  for (let i = 0; i < 60; i += 1) {
    await sleep(3000);
    const res = await fetch(`${API}/tasks/${job.taskid}`, { signal: AbortSignal.timeout(30000) });
    const task = await res.json();
    if (task.status === 'finished') return task.data.total_population;
    if (task.status === 'failed') throw new Error(`WorldPop task failed: ${task.error_message ?? ''}`);
  }
  throw new Error('WorldPop task timed out');
}

// Reference totals for a sanity check (2019 national censuses): a big mismatch means the polygons are wrong.
const CENSUS_2019 = { Nairobi: 4397073, Kampala: 1680600 };

export async function importPopulation({ force = false, concurrency = 2, log = console.log } = {}) {
  const { rows: wards } = await pool.query(
    `SELECT id, name, city, ST_AsGeoJSON(ST_SimplifyPreserveTopology(boundary::geometry, 0.0002)) AS geojson
       FROM wards WHERE boundary IS NOT NULL ${force ? '' : 'AND population IS NULL'} ORDER BY city, name`);
  log(`Population — ${wards.length} wards to look up (WorldPop, concurrency ${concurrency})`);
  let done = 0;
  const failed = [];
  const queue = [...wards];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const w = queue.shift();
        try {
          let total;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              total = await worldpopTotal(JSON.parse(w.geojson));
              break;
            } catch (err) {
              if (attempt === 3) throw err;
              await sleep(attempt * 5000);
            }
          }
          await pool.query('UPDATE wards SET population = $2, population_source = $3, population_year = 2020, population_updated_at = now() WHERE id = $1', [w.id, Math.round(total), POP_SOURCE]);
          done += 1;
          log(`  ${done}/${wards.length} ${w.city} / ${w.name}: ${Math.round(total).toLocaleString()}`);
        } catch (err) {
          failed.push(`${w.name}: ${err.message}`);
          log(`  FAILED ${w.name}: ${err.message}`);
        }
      }
    })
  );

  const { rows: totals } = await pool.query('SELECT city, sum(population)::bigint AS pop, count(*)::int AS wards, count(population)::int AS with_pop FROM wards GROUP BY city ORDER BY city');
  const checks = totals.map((t) => {
    const ref = CENSUS_2019[t.city];
    const ratio = ref ? t.pop / ref : null;
    return { city: t.city, wards: t.wards, withPopulation: t.with_pop, worldpopTotal: Number(t.pop), census2019: ref ?? null, ratio: ratio && Number(ratio.toFixed(2)), plausible: ratio == null ? null : ratio > 0.75 && ratio < 1.25 };
  });
  checks.forEach((c) => log(`  check ${c.city}: WorldPop sum ${c.worldpopTotal.toLocaleString()} vs 2019 census ${c.census2019?.toLocaleString()} (ratio ${c.ratio}) ${c.plausible === false ? '⚠ OUT OF RANGE' : ''}`));
  return { updated: done, failed, checks };
}
