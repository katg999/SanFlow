import { distanceKm } from './geo.js';

const DAY = 24 * 3600 * 1000;
export const isFunctional = (f) => !['broken', 'closed'].includes(f.status);
export const needsAttention = (f) => ['dirty', 'filling', 'full', 'broken'].includes(f.status);

// WHO-style planning ratio used in the brief's example: 12,000 people -> 12 toilets.
export const PEOPLE_PER_TOILET = 1000;

// Ward gap analysis runs on the server (one PostGIS spatial join over real ward polygons): see GET /api/analytics/wards.

export function daysBroken(facility, reports, now = Date.now()) {
  if (facility.status !== 'broken') return 0;
  const since =
    facility.brokenSince ??
    reports.filter((r) => r.facilityId === facility.id && r.type === 'broken').map((r) => r.at).sort()[0];
  return since ? Math.floor((now - new Date(since).getTime()) / DAY) : 0;
}

export function avgResolutionHours(reports) {
  const done = reports.filter((r) => r.status === 'resolved' && r.resolvedAt);
  if (!done.length) return null;
  const total = done.reduce((a, r) => a + (new Date(r.resolvedAt) - new Date(r.at)), 0);
  return total / done.length / 3600000;
}

// Volume actually delivered to a registered treatment partner. No climate conversion is applied: a CO2e figure
// needs a verified methodology, so we report the measured volume only.
export function deliveredVolume(jobs) {
  const m3 = jobs.filter((j) => j.status === 'done' && j.destination).reduce((a, j) => a + (j.volumeM3 ?? 0), 0);
  return { m3 };
}

// Greedy nearest-neighbour ordering — groups nearby jobs to save fuel & time.
export function optimizeRoute(start, stops) {
  const remaining = [...stops];
  const order = [];
  let cur = start;
  let dist = 0;
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((s, i) => {
      const d = distanceKm(cur, s);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const [next] = remaining.splice(bi, 1);
    order.push(next);
    dist += bd;
    cur = next;
  }
  return { order, km: dist };
}

export function pathKm(start, stops) {
  let cur = start;
  let d = 0;
  for (const s of stops) {
    d += distanceKm(cur, s);
    cur = s;
  }
  return d;
}
