// Proximity logic per the developer brief: "Always sort results by shortest distance."

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function sortByProximity(facilities, origin) {
  if (!origin) return facilities;
  return [...facilities].sort(
    (a, b) => distanceKm(origin, a) - distanceKm(origin, b)
  );
}

// Rough on-the-ground ETA, not a routed path: straight-line distance is
// inflated by a street-detour factor, then split across typical urban
// walking / boda-boda-or-car speeds. Good enough for "about X min", not
// turn-by-turn directions.
const DETOUR_FACTOR = 1.3;
const WALK_KMH = 4.5;
const DRIVE_KMH = 18;

export function estimateEta(km) {
  if (!Number.isFinite(km)) return null;
  const roadKm = km * DETOUR_FACTOR;
  return {
    walkMin: Math.max(1, Math.round((roadKm / WALK_KMH) * 60)),
    driveMin: Math.max(1, Math.round((roadKm / DRIVE_KMH) * 60)),
  };
}
