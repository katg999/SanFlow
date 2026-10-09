// In-site walking directions: free OSRM routing (no API key) drawn on our own
// Leaflet map, so users never leave the platform for Google Maps.
import { distanceKm } from './geo.js';

const ENDPOINTS = [
  'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  'https://router.project-osrm.org/route/v1/foot',
];
const WALK_MS = 1.25; // ~4.5 km/h
export const OFF_ROUTE_M = 40;
export const ARRIVE_M = 25;

const metres = (a, b) => distanceKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 1000;

function cumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) cum.push(cum[i - 1] + metres(coords[i - 1], coords[i]));
  return cum;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function instruction(step, destName) {
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` onto ${step.name}` : '';
  const dir = modifier ? modifier.replace('slight ', 'slight ').replace('sharp ', 'sharp ') : '';
  switch (type) {
    case 'depart':
      return `Head ${COMPASS[Math.round((step.maneuver.bearing_after ?? 0) / 45) % 8]}${step.name ? ` on ${step.name}` : ''}`;
    case 'arrive':
      return `You have arrived at ${destName}`;
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${road}`;
    case 'continue':
    case 'new name':
      return dir && dir !== 'straight' ? `Continue ${dir}${road}` : `Continue straight${road}`;
    default:
      if (!dir || dir === 'straight') return `Continue straight${road}`;
      if (dir === 'uturn') return 'Make a U-turn';
      return `Turn ${dir}${road}`;
  }
}

function build(coords, steps, destName, source) {
  const cum = cumulative(coords);
  const distance = cum[cum.length - 1];
  let acc = 0;
  const withStart = steps.map((s) => {
    const out = { ...s, startM: acc };
    acc += s.distance;
    return out;
  });
  return { coords, cum, steps: withStart, distance, duration: distance / WALK_MS, source };
}

export async function fetchWalkingRoute(from, to, destName = 'your destination') {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  for (const base of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(`${base}/${path}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) continue;
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const steps = route.legs[0].steps.map((s) => ({
        text: instruction(s, destName),
        distance: s.distance,
        type: s.maneuver.type,
        modifier: s.maneuver.modifier,
      }));
      return build(coords, steps, destName, 'osrm');
    } catch {
      // try next endpoint
    }
  }
  // Offline fallback: straight line with an estimated distance.
  const coords = [[from.lat, from.lng], [to.lat, to.lng]];
  const d = metres(coords[0], coords[1]) * 1.3;
  return build(
    coords,
    [
      { text: `Head towards ${destName}`, distance: d, type: 'depart' },
      { text: `You have arrived at ${destName}`, distance: 0, type: 'arrive' },
    ],
    destName,
    'estimate'
  );
}

// Project a position onto the route: how far along it, and how far off it.
export function snapToRoute(route, pos) {
  const { coords, cum } = route;
  let best = { off: Infinity, progress: 0 };
  const cosLat = Math.cos((pos.lat * Math.PI) / 180);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [aLat, aLng] = coords[i];
    const [bLat, bLng] = coords[i + 1];
    const bx = (bLng - aLng) * cosLat * 111320;
    const by = (bLat - aLat) * 110540;
    const px = (pos.lng - aLng) * cosLat * 111320;
    const py = (pos.lat - aLat) * 110540;
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const off = Math.hypot(px - t * bx, py - t * by);
    if (off < best.off) best = { off, progress: cum[i] + t * Math.sqrt(len2) };
  }
  return best;
}

export function pointAlong(route, m) {
  const { coords, cum } = route;
  if (m <= 0) return { lat: coords[0][0], lng: coords[0][1] };
  const total = cum[cum.length - 1];
  if (m >= total) {
    const last = coords[coords.length - 1];
    return { lat: last[0], lng: last[1] };
  }
  let i = 1;
  while (cum[i] < m) i += 1;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (m - cum[i - 1]) / seg;
  return {
    lat: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
    lng: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
  };
}

export function currentStepIndex(route, progressM) {
  let idx = 0;
  route.steps.forEach((s, i) => {
    if (s.startM <= progressM + 1) idx = i;
  });
  return idx;
}

export const UNUSABLE = new Set(['broken', 'full', 'closed']);

// Nearest facility of a category that is actually usable right now.
export function nearestUsable(facilities, origin, category = 'toilet') {
  let best = null;
  let bestD = Infinity;
  for (const f of facilities) {
    // customers-only facilities are never recommended as a public toilet
    if (f.category !== category || UNUSABLE.has(f.status) || f.access === 'customers') continue;
    const d = distanceKm(origin, f);
    if (d < bestD) {
      best = f;
      bestD = d;
    }
  }
  return best ? { facility: best, km: bestD } : null;
}
