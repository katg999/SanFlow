// Normalises API facilities for display. Only values the data actually contains are shown:
// unknown stays unknown (undefined) and the UI says "not reported" — nothing is estimated or invented.

export function currencyFor(country) {
  return country === 'Uganda' ? 'UGX' : 'KES';
}

export function formatFee(fee, country) {
  if (fee == null) return null;
  if (fee === 0) return 'Free';
  return `${currencyFor(country)} ${fee}`;
}

export function minutesSince(iso, now = Date.now()) {
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export function formatAgo(mins) {
  if (mins == null) return 'unknown';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const QUEUE_LABEL = { none: 'No queue', short: 'Short queue', long: 'Long queue' };
export const QUALITY_LABEL = { safe: 'Safe to drink', treated: 'Treated', untested: 'Untested', unsafe: 'Unsafe' };

export function enrichFacility(f) {
  return {
    ...f,
    // only known when an operator / sensor has recorded a cleaning
    lastCleanedMins: f.lastCleanedAt ? minutesSince(f.lastCleanedAt) : null,
    amenities: f.amenities ?? null,
    photos: f.photos ?? [],
    usage: f.usage ?? 0,
    capacity: f.capacity ?? 400,
    daily: f.daily ?? [0, 0, 0, 0, 0, 0, 0],
  };
}
