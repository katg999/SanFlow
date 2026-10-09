// Anti-fake-report rules (E.3). Pure functions so they can be unit tested.
export const NEAR_M = 300;      // a report from within this distance of the facility counts fully
export const FAR_WEIGHT = 0.4;  // reports from far away count less
export const NO_GPS_WEIGHT = 0.5;
export const VERIFY_AT = 1;     // weighted confirmations needed before the public status changes
export const DAY_MS = 24 * 3600 * 1000;

export const STATUS_FOR_TYPE = { broken: 'broken', full: 'full', dirty: 'dirty' };

export function reportWeight({ hasFacility, distanceM }) {
  if (!hasFacility) return 1;
  if (distanceM == null) return NO_GPS_WEIGHT;
  return distanceM <= NEAR_M ? 1 : FAR_WEIGHT;
}

/**
 * @param recent  unresolved reports for the same facility+type in the last 24h:
 *                [{ reporter_key, weight }]  (for dumping: same reporter within ~100 m)
 */
export function evaluateReport({ hasFacility, type, reporterKey, distanceM, recent }) {
  if (recent.some((r) => r.reporter_key === reporterKey)) {
    return { duplicate: true, weight: 0, verified: false };
  }
  const weight = reportWeight({ hasFacility, distanceM });
  const total = recent.reduce((a, r) => a + Number(r.weight), 0) + weight;
  // illegal dumping has no facility to corroborate against — accept it, field teams verify on site
  const verified = !hasFacility || type === 'dumping' || total >= VERIFY_AT;
  return { duplicate: false, weight, verified };
}

export function jobTypeFor({ type, category }) {
  if (type === 'full') return category === 'waste' ? 'waste' : 'pit';
  if (type === 'dumping') return 'waste';
  if (type === 'broken' && category === 'water') return 'water';
  return null;
}
