// Pure mapping from OpenStreetMap elements to our facility records (unit tested).
// Rule: only store what OSM actually says. Unknown stays null — never invented.

const CATEGORY_RULES = [
  ['toilet', (t) => t.amenity === 'toilets'],
  ['water', (t) => ['drinking_water', 'water_point'].includes(t.amenity) || ['water_well', 'water_tap'].includes(t.man_made)],
  ['waste', (t) => ['waste_disposal', 'recycling', 'waste_transfer_station', 'sanitary_dump_station'].includes(t.amenity)],
  ['health', (t) => ['clinic', 'hospital', 'pharmacy', 'doctors'].includes(t.amenity)],
];

export const categoryOf = (tags = {}) => CATEGORY_RULES.find(([, test]) => test(tags))?.[0] ?? null;

const GENERIC = {
  toilets: 'Public toilet', drinking_water: 'Drinking water point', water_point: 'Water point', water_well: 'Water well / borehole',
  water_tap: 'Water tap', waste_disposal: 'Waste disposal point', recycling: 'Recycling point', waste_transfer_station: 'Waste transfer station',
  sanitary_dump_station: 'Sanitary dump station', clinic: 'Clinic', hospital: 'Hospital', pharmacy: 'Pharmacy', doctors: 'Doctor\'s practice',
};
export const genericName = (tags) => GENERIC[tags.amenity] ?? GENERIC[tags.man_made] ?? 'Facility';

// 'private' → not imported; 'customers' → shown but never recommended as a public facility.
export function accessOf(tags = {}) {
  const a = (tags.access ?? '').toLowerCase();
  if (['private', 'no'].includes(a)) return 'private';
  if (['customers', 'permit', 'members'].includes(a)) return 'customers';
  return 'public';
}

// fee=no → 0; charge="KES 10" / "10 KES" / "Ksh 20" / "UGX 500" / "20/=" → the number; fee=yes without an amount → null.
export function parseFee(tags = {}) {
  if (tags.fee === 'no') return 0;
  if (tags.charge) {
    const m = String(tags.charge).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (m) return Math.round(Number(m[1]));
  }
  return null;
}

export function amenitiesOf(tags = {}) {
  const yes = (v) => ['yes', 'designated'].includes(String(v ?? '').toLowerCase());
  const out = [];
  if (yes(tags.wheelchair) || yes(tags['toilets:wheelchair'])) out.push('Disability access');
  if (yes(tags.handwashing) || yes(tags['toilets:handwashing'])) out.push('Handwashing');
  if (yes(tags.lit)) out.push('Lighting');
  if (yes(tags.changing_table) || yes(tags['diaper'])) out.push('Baby change');
  return out.length ? out : null;
}

export function descriptionOf(tags = {}) {
  const parts = [];
  if (tags.operator) parts.push(`Operated by ${tags.operator}.`);
  if (tags.description) parts.push(String(tags.description));
  if (tags.drinking_water === 'no' && tags.amenity !== 'toilets') parts.push('Not marked as drinking water in OpenStreetMap.');
  return parts.join(' ').slice(0, 400) || null;
}

/** Returns a facility record, or { skip: reason }. */
export function mapElement(el, region) {
  const tags = el.tags ?? {};
  const category = categoryOf(tags);
  if (!category) return { skip: 'not-a-wash-facility' };
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return { skip: 'no-coordinates' };
  if (tags.disused === 'yes' || tags.abandoned === 'yes') return { skip: 'disused' };
  const access = accessOf(tags);
  if (access === 'private') return { skip: 'private-access' };

  return {
    id: `osm-${el.type}-${el.id}`,
    category,
    name: String(tags.name ?? genericName(tags)).slice(0, 120),
    named: Boolean(tags.name),
    area: String(tags['addr:suburb'] ?? tags['addr:city'] ?? region.fallbackArea).slice(0, 120),
    country: region.country,
    lat,
    lng,
    hours: tags.opening_hours ? String(tags.opening_hours).slice(0, 120) : null,
    fee: category === 'toilet' || category === 'water' ? parseFee(tags) : null,
    amenities: category === 'toilet' ? amenitiesOf(tags) : null,
    description: descriptionOf(tags),
    access,
    tags,
  };
}
