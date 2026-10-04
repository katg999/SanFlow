// Free, keyless OpenStreetMap data via the Overpass API — used to blend real
// public toilets and waste disposal points into the mock facility dataset.

const KAMPALA_BBOX = { south: 0.25, west: 32.52, north: 0.38, east: 32.66 };
const NAIROBI_BBOX = { south: -1.34, west: 36.75, north: -1.25, east: 36.88 };

export const OSM_REGIONS = [
  { key: 'kampala', country: 'Uganda', areaFallback: 'Kampala area', bbox: KAMPALA_BBOX },
  { key: 'nairobi', country: 'Kenya', areaFallback: 'Nairobi area', bbox: NAIROBI_BBOX },
];

export function bboxString(bbox) {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

function inBbox(lat, lng, bbox) {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
}

function regionForPoint(lat, lng) {
  return OSM_REGIONS.find((r) => inBbox(lat, lng, r.bbox)) ?? null;
}

function titleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Overpass returns nodes (lat/lon) and ways (center.lat/center.lon with `out center;`).
export function osmElementToFacility(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const amenity = tags.amenity;
  let category = null;
  if (amenity === 'toilets') category = 'toilet';
  else if (amenity === 'waste_disposal' || amenity === 'recycling') category = 'waste';
  if (!category) return null;

  const region = regionForPoint(lat, lng);
  if (!region) return null;

  const name = tags.name || (category === 'toilet' ? 'Public Toilet' : titleCase(amenity));
  const area = tags['addr:suburb'] || tags['addr:city'] || region.areaFallback;

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    category,
    area,
    country: region.country,
    lat,
    lng,
    status: tags.access === 'no' || tags.access === 'private' ? 'closed' : 'unverified',
    rating: 0,
    ratingsCount: 0,
    hours: tags.opening_hours || null,
    description:
      category === 'toilet'
        ? 'Public toilet imported from OpenStreetMap. Not yet rated by the community — be the first.'
        : 'Waste disposal point imported from OpenStreetMap. Not yet rated by the community — be the first.',
    source: 'osm',
  };
}

// OSM coverage in some areas is dense enough to return thousands of results
// (individual bins, every mapped skip, etc.) — far more than a map view or
// sidebar list can usefully show. Keep only the nearest N per category per
// region, closest-to-center first, so the map stays legible and fast.
const MAX_PER_CATEGORY_PER_REGION = 60;

function regionCenter(bbox) {
  return { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 };
}

function distanceSq(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

export function capOsmFacilities(facilities, maxPerGroup = MAX_PER_CATEGORY_PER_REGION) {
  const groups = new Map();
  for (const f of facilities) {
    const key = `${f.country}:${f.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  const result = [];
  for (const list of groups.values()) {
    const region = OSM_REGIONS.find((r) => r.country === list[0].country);
    const center = region ? regionCenter(region.bbox) : null;
    const sorted = center
      ? [...list].sort((a, b) => distanceSq(a, center) - distanceSq(b, center))
      : list;
    result.push(...sorted.slice(0, maxPerGroup));
  }
  return result;
}
