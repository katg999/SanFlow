// SQL fragment + mapper that turn facility rows into the JSON shape the web app consumes.
// List view: cheap columns only (thousands of rows). Detail / owner views add photos, usage and the 7-day series.
export const FACILITY_LITE = `
  f.id, f.category, f.name, f.area, f.country,
  ST_Y(f.geom::geometry) AS lat, ST_X(f.geom::geometry) AS lng,
  f.image, f.description, f.hours, f.status, f.fee, f.amenities, f.licensed, f.licence_no, f.access,
  f.discount_pct, f.discount_label, f.owner_org_id, f.source,
  f.rating::float AS rating, f.ratings_count,
  s.last_cleaned_at, s.queue, s.water_quality, s.broken_since, s.last_confirmed_at
`;
export const FACILITY_SELECT = `${FACILITY_LITE},
  f.photos, s.usage_count, s.capacity, s.last_confirmed_working,
  (SELECT max(r.created_at) FROM reports r WHERE r.facility_id = f.id AND r.verified) AS last_reported_at,
  (SELECT coalesce(array_agg(coalesce(d.customers, 0) ORDER BY g.day), '{}')
     FROM generate_series(current_date - 6, current_date, interval '1 day') g(day)
     LEFT JOIN facility_daily d ON d.facility_id = f.id AND d.day = g.day::date) AS daily
`;
export const FACILITY_FROM = 'facilities f LEFT JOIN facility_state s ON s.facility_id = f.id';

export function toFacility(r) {
  return stripNulls({
    id: r.id,
    name: r.name,
    category: r.category,
    image: r.image ?? undefined,
    area: r.area,
    country: r.country,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    rating: r.rating,
    ratingsCount: r.ratings_count,
    hours: r.hours ?? undefined,
    description: r.description ?? undefined,
    reports: [],
    lastReportedAt: r.last_reported_at ?? undefined,
    fee: r.fee,
    amenities: r.amenities ?? null,
    licensed: r.licensed,
    licenseNo: r.licence_no,
    discount: r.discount_pct ? { pct: r.discount_pct, label: r.discount_label || `${r.discount_pct}% discount` } : null,
    photos: r.photos ?? [],
    access: r.access,
    ownerId: r.owner_org_id,
    source: r.source,
    queue: r.queue,
    waterQuality: r.water_quality,
    lastCleanedAt: r.last_cleaned_at,
    lastConfirmedAt: r.last_confirmed_at,
    usage: r.usage_count ?? undefined,
    capacity: r.capacity ?? undefined,
    brokenSince: r.broken_since,
    daily: r.daily ?? undefined,
    ...(r.distance_m != null ? { distanceM: Math.round(r.distance_m) } : {}),
  });
}

// Absent means "not known" — keeps the 12,000-row list small and never sends invented defaults.
function stripNulls(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0 && false)));
}

export const toReport = (r) => ({
  id: r.id,
  facilityId: r.facility_id,
  type: r.type,
  note: r.note,
  photo: r.photo ?? undefined,
  hasPhoto: Boolean(r.has_photo ?? r.photo),
  lat: r.lat ?? undefined,
  lng: r.lng ?? undefined,
  userName: r.reporter_name,
  weight: r.weight,
  verified: r.verified,
  status: r.status,
  assignedTo: r.assigned_id ? { kind: r.assigned_kind, id: r.assigned_id, name: r.assigned_name } : undefined,
  at: r.created_at,
  resolvedAt: r.resolved_at ?? undefined,
});

export const REPORT_SELECT = `r.id, r.facility_id, r.type, r.note, (r.photo IS NOT NULL) AS has_photo, r.reporter_name, r.weight::float AS weight, r.verified,
  r.status, r.assigned_kind, r.assigned_id, r.assigned_name, r.created_at, r.resolved_at,
  ST_Y(r.geom::geometry) AS lat, ST_X(r.geom::geometry) AS lng`;

export const toJob = (r) => ({
  id: r.id,
  type: r.type,
  facilityId: r.facility_id,
  reportId: r.report_id,
  lat: r.lat ?? undefined,
  lng: r.lng ?? undefined,
  priority: r.priority,
  zone: r.zone,
  status: r.status,
  providerId: r.provider_id,
  volumeM3: r.volume_m3 ?? undefined,
  amountKES: r.amount_kes ?? undefined,
  destination: r.destination ?? undefined,
  before: r.before_photo ?? undefined,
  after: r.after_photo ?? undefined,
  hasPhotos: Boolean(r.has_photos ?? r.before_photo),
  receiptNo: r.receipt_no ?? undefined,
  createdAt: r.created_at,
  completedAt: r.completed_at ?? undefined,
});

export const JOB_SELECT = `j.id, j.type, j.facility_id, j.report_id, j.priority, j.zone, j.status, j.provider_id,
  j.volume_m3::float AS volume_m3, j.amount_kes, j.destination, (j.before_photo IS NOT NULL) AS has_photos, j.receipt_no,
  j.created_at, j.completed_at, ST_Y(j.geom::geometry) AS lat, ST_X(j.geom::geometry) AS lng`;

export const toNotice = (r) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  area: r.area,
  channel: r.channels,
  sent: r.recipients,
  by: r.sent_by,
  at: r.created_at,
});

export const toUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  orgId: r.org_id ?? undefined,
  active: r.active,
  joined: r.created_at,
});
