// Metro areas covered by the import. `county` is the OSM admin_level=4 relation used to keep only wards
// that really belong to the city (a bounding box also catches neighbouring counties).
export const REGIONS = [
  { key: 'nairobi', city: 'Nairobi', country: 'Kenya', fallbackArea: 'Greater Nairobi', bbox: [-1.47, 36.6, -1.1, 37.15], countyName: 'Nairobi', wardLevel: 8 },
  { key: 'kampala', city: 'Kampala', country: 'Uganda', fallbackArea: 'Greater Kampala', bbox: [0.15, 32.45, 0.5, 32.75], countyName: 'Kampala', wardLevel: 8 },
];
export const bboxStr = (r) => r.bbox.join(',');
