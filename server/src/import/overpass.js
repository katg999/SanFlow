// Overpass API client for the public mirrors. Mirrors are tried in order, with retries and backoff:
// the free instances are community-run and are frequently busy or unreachable from a given network.
const MIRRORS = (process.env.OVERPASS_MIRRORS ||
  'https://overpass.openstreetmap.fr/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
  .split(',');
const UA = 'SanFlow-WASHLink-importer/1.0 (info@sanflow.co.ke)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function overpass(query, { rounds = 3, timeoutMs = 150000, log = console.log } = {}) {
  let lastErr;
  for (let round = 1; round <= rounds; round += 1) {
    for (const url of MIRRORS) {
      const host = new URL(url).host;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = JSON.parse(text);
        if (data.remark && /error|timed out|out of memory/i.test(data.remark)) throw new Error(`overpass remark: ${data.remark}`);
        return data;
      } catch (err) {
        lastErr = err;
        log(`  overpass ${host} failed (${err.message}); trying next`);
      }
    }
    if (round < rounds) {
      log(`  all mirrors failed, retrying in ${round * 10}s`);
      await sleep(round * 10000);
    }
  }
  throw new Error(`Overpass unavailable after ${rounds} rounds: ${lastErr?.message}`);
}
