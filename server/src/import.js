import './env.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { importWards } from './import/wards.js';
import { importPopulation } from './import/population.js';
import { importFacilities } from './import/facilities.js';

// npm run import -- [wards] [population] [facilities]   (no args = all, in the right order)
// Order matters: wards first (facilities are located inside them), then population, then facilities.
const steps = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = steps.length === 0;
const force = process.argv.includes('--force');

async function main() {
  await migrate();
  if (all || steps.includes('wards')) console.log(JSON.stringify(await importWards(), null, 2));
  if (all || steps.includes('population')) {
    const r = await importPopulation({ force });
    console.log(JSON.stringify(r, null, 2));
  }
  if (all || steps.includes('facilities')) console.log(JSON.stringify(await importFacilities(), null, 2));
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
