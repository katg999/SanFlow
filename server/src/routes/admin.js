import { Router } from 'express';
import { query, tx } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap, bad, oneOf, HttpError } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { toNotice, toUser } from '../lib/serialize.js';

export const notices = Router();
export const users = Router();
export const directory = Router();
export const analytics = Router();
export const auditRoutes = Router();
export const publicStats = Router();

const ROLES = ['citizen', 'operator', 'provider', 'municipality', 'admin'];
const PEOPLE_PER_TOILET = 1000;

// ---- Bulk notices (D.6) -------------------------------------------------
notices.get('/', wrap(async (_req, res) => {
  const { rows } = await query('SELECT * FROM notices ORDER BY created_at DESC LIMIT 20');
  res.json({ notices: rows.map(toNotice) });
}));

notices.post('/', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.body) throw bad('title and body are required');
  const channels = [b.sms && 'SMS', b.app !== false && 'App'].filter(Boolean).join(' + ');
  const area = String(b.area || 'All areas');
  const notice = await tx(async (c) => {
    const { rows: [{ pop }] } = await c.query(
      area === 'All areas' ? 'SELECT coalesce(sum(population), 0)::int AS pop FROM wards' : 'SELECT coalesce(sum(population), 0)::int AS pop FROM wards WHERE name = $1',
      area === 'All areas' ? [] : [area]);
    const { rows: [n] } = await c.query(
      'INSERT INTO notices(title, body, area, channels, recipients, sent_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [String(b.title).slice(0, 140), String(b.body).slice(0, 1000), area, channels || 'App', pop, req.user.name]);
    await audit(c, req.user, 'Sent bulk notice', `${area} (${channels})`);
    return n;
  });
  // SMS gateway (Africa's Talking) hook goes here once credentials exist — see docs/BACKEND.md.
  res.status(201).json({ notice: toNotice(notice) });
}));

// ---- Users & roles (super admin) ----------------------------------------
users.use(requireAuth, requireRole('admin'));

users.get('/', wrap(async (_req, res) => {
  const { rows } = await query('SELECT id, name, email, role, org_id, active, created_at FROM users ORDER BY created_at DESC');
  res.json({ users: rows.map(toUser) });
}));

users.patch('/:id', wrap(async (req, res) => {
  const { role, active } = req.body || {};
  if (req.params.id === req.user.id) throw bad('you cannot change your own role or status');
  const user = await tx(async (c) => {
    const { rows: [u] } = await c.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!u) throw new HttpError(404, 'Not found');
    let orgId = u.org_id;
    if (role !== undefined) {
      oneOf(role, ROLES, 'role');
      if ((role === 'operator' || role === 'provider') && !orgId) {
        await c.query('INSERT INTO organisations(id, kind, name, provider_kind) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [u.id, role, u.name, role === 'provider' ? 'Sewage exhauster' : null]);
        orgId = u.id;
      }
    }
    const { rows: [updated] } = await c.query(
      'UPDATE users SET role = coalesce($2, role), active = coalesce($3, active), org_id = $4 WHERE id = $1 RETURNING id, name, email, role, org_id, active, created_at',
      [u.id, role ?? null, typeof active === 'boolean' ? active : null, orgId]);
    await audit(c, req.user, 'Updated user', `${u.email}: ${[role && `role=${role}`, typeof active === 'boolean' && `active=${active}`].filter(Boolean).join(', ')}`);
    return updated;
  });
  res.json({ user: toUser(user) });
}));

// ---- Directory ----------------------------------------------------------
directory.get('/providers', requireAuth, wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT o.*, (SELECT count(*) FROM jobs j WHERE j.provider_id = o.id AND j.status = 'done')::int AS jobs_done
       FROM organisations o WHERE o.kind = 'provider' ORDER BY o.name`);
  res.json({ providers: rows.map((o) => ({ id: o.id, name: o.name, kind: o.provider_kind, zone: o.zone, licensed: o.licensed, licenceNo: o.licence_no, rating: o.rating > 0 ? o.rating : null, phone: o.phone, services: o.services, fleet: o.fleet, jobsDone: o.jobs_done })) });
}));
// A provider / operator edits their own public profile (zone, service type, contact). Nothing is pre-filled for them.
const PROVIDER_KINDS = ['Sewage exhauster', 'Waste collector', 'Water point repair'];
directory.patch('/me', requireAuth, requireRole('operator', 'provider'), wrap(async (req, res) => {
  if (!req.user.orgId) throw bad('no organisation on this account');
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (b.name !== undefined) set('name', String(b.name).trim().slice(0, 120) || req.user.name);
  if (b.zone !== undefined) set('zone', oneOf(b.zone, ['Nairobi', 'Kampala'], 'zone'));
  if (b.phone !== undefined) set('phone', String(b.phone).slice(0, 40));
  if (b.fleet !== undefined) set('fleet', Math.max(1, Math.min(500, Number(b.fleet) || 1)));
  if (b.services !== undefined) set('services', Array.isArray(b.services) ? b.services.slice(0, 10).map((x) => String(x).slice(0, 80)) : []);
  if (b.licenceNo !== undefined) set('licence_no', String(b.licenceNo).slice(0, 60));
  if (b.providerKind !== undefined && req.user.role === 'provider') set('provider_kind', oneOf(b.providerKind, PROVIDER_KINDS, 'providerKind'));
  if (!sets.length) throw bad('nothing to update');
  vals.push(req.user.orgId);
  await tx(async (c) => {
    await c.query(`UPDATE organisations SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    await audit(c, req.user, 'Updated organisation profile', req.user.name);
  });
  res.json({ ok: true });
}));

// Licence verification of providers / operators is a municipality decision, never self-declared.
directory.patch('/organisations/:id/licence', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  const licensed = Boolean(req.body?.licensed);
  const org = await tx(async (c) => {
    const { rows: [o] } = await c.query('UPDATE organisations SET licensed = $2 WHERE id = $1 RETURNING id, name, licensed', [req.params.id, licensed]);
    if (!o) throw new HttpError(404, 'Not found');
    await audit(c, req.user, licensed ? 'Verified licence' : 'Marked unlicensed', o.name);
    return o;
  });
  res.json({ organisation: org });
}));

directory.get('/operators', requireAuth, requireRole('municipality', 'admin'), wrap(async (_req, res) => {
  const { rows } = await query("SELECT id, name, zone, licensed FROM organisations WHERE kind = 'operator' ORDER BY name");
  res.json({ operators: rows });
}));
directory.get('/partners', requireAuth, wrap(async (_req, res) => {
  const { rows } = await query('SELECT * FROM treatment_partners ORDER BY name');
  res.json({ partners: rows });
}));
// Waste-to-value partners that receive collected waste. Managed by the municipality / admin — none are pre-loaded.
directory.post('/partners', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  const { name, product } = req.body || {};
  if (!name || !product) throw bad('name and product are required');
  const partner = await tx(async (c) => {
    const { rows: [p] } = await c.query('INSERT INTO treatment_partners(id, name, product) VALUES ($1, $2, $3) RETURNING *',
      [`tp-${Date.now().toString(36)}`, String(name).trim().slice(0, 120), String(product).trim().slice(0, 80)]);
    await audit(c, req.user, 'Added treatment partner', p.name);
    return p;
  });
  res.status(201).json({ partner });
}));
directory.delete('/partners/:id', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  await tx(async (c) => {
    const used = await c.query('SELECT 1 FROM jobs WHERE destination = $1 LIMIT 1', [req.params.id]);
    if (used.rowCount) throw new HttpError(409, 'This partner has delivery records and cannot be removed');
    const { rows: [p] } = await c.query('DELETE FROM treatment_partners WHERE id = $1 RETURNING name', [req.params.id]);
    if (!p) throw new HttpError(404, 'Not found');
    await audit(c, req.user, 'Removed treatment partner', p.name);
  });
  res.json({ ok: true });
}));

// ---- Analytics for the municipality control tower -------------------------
analytics.use(requireAuth, requireRole('municipality', 'admin'));

// Ward gap analysis: one PostGIS spatial join over real OSM ward polygons. Counts public-access toilets only.
// A ward with no population yet reports nulls instead of a made-up figure.
analytics.get('/wards', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT w.id, w.name, w.city, w.population, w.population_source, w.population_year,
            ST_Y(w.center::geometry) AS lat, ST_X(w.center::geometry) AS lng,
            round((ST_Area(w.boundary) / 1000000)::numeric, 1)::float AS area_km2,
            count(f.id) FILTER (WHERE f.category = 'toilet')::int AS toilets,
            count(f.id) FILTER (WHERE f.category = 'toilet' AND f.status NOT IN ('broken', 'closed'))::int AS working,
            count(f.id) FILTER (WHERE f.category = 'toilet' AND f.status IN ('dirty', 'filling', 'full', 'broken'))::int AS toilets_attention,
            count(f.id) FILTER (WHERE f.category = 'water')::int AS water,
            count(f.id) FILTER (WHERE f.category = 'water' AND f.status = 'broken')::int AS broken_water,
            count(f.id) FILTER (WHERE f.category = 'waste' AND f.status = 'full')::int AS full_waste
       FROM wards w
       LEFT JOIN facilities f ON NOT f.osm_gone AND f.access = 'public' AND ST_Covers(w.boundary, f.geom)
      WHERE w.boundary IS NOT NULL
      GROUP BY w.id ORDER BY w.city, w.name`);
  const wards = rows.map((w) => {
    const known = w.population != null;
    const required = known ? Math.ceil(w.population / PEOPLE_PER_TOILET) : null;
    const gap = known ? Math.max(0, required - w.working) : null;
    const risk = w.broken_water * 3 + w.full_waste * 2 + Math.min(gap ?? 0, 10) * 0.5 + w.toilets_attention;
    return {
      id: w.id, name: w.name, city: w.city, lat: w.lat, lng: w.lng, areaKm2: w.area_km2,
      population: w.population, populationSource: w.population_source, populationYear: w.population_year,
      toilets: w.toilets, working: w.working, required, gap,
      coveragePct: known ? Math.min(100, Math.round((w.working / required) * 100)) : null,
      water: w.water, brokenWater: w.broken_water, fullWaste: w.full_waste,
      risk, riskLevel: risk >= 6 ? 'High' : risk >= 3 ? 'Medium' : 'Low',
    };
  });
  res.json({ wards, standard: `1 public toilet per ${PEOPLE_PER_TOILET} people` });
}));

// Simplified ward polygons (≈ 50 m tolerance) for the choropleth map.
analytics.get('/wards.geojson', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, city, ST_AsGeoJSON(ST_SimplifyPreserveTopology(boundary::geometry, 0.0005), 5)::json AS geometry
       FROM wards WHERE boundary IS NOT NULL`);
  res.json({ type: 'FeatureCollection', features: rows.map((w) => ({ type: 'Feature', properties: { id: w.id, name: w.name, city: w.city }, geometry: w.geometry })) });
}));

analytics.get('/summary', wrap(async (_req, res) => {
  const { rows: [s] } = await query(
    `SELECT (SELECT count(*) FROM facilities WHERE NOT osm_gone)::int AS facilities,
            (SELECT count(*) FROM facilities WHERE NOT osm_gone AND status NOT IN ('broken', 'closed'))::int AS functional,
            (SELECT count(*) FROM facilities WHERE NOT osm_gone AND category = 'toilet')::int AS toilets,
            (SELECT count(*) FROM reports WHERE verified AND status <> 'resolved')::int AS open_reports,
            (SELECT avg(extract(epoch FROM resolved_at - created_at)) / 3600 FROM reports WHERE status = 'resolved' AND resolved_at IS NOT NULL) AS avg_resolution_hours,
            (SELECT coalesce(sum(volume_m3), 0) FROM jobs WHERE status = 'done' AND destination IS NOT NULL)::float AS m3_to_treatment`);
  res.json({ ...s, avg_resolution_hours: s.avg_resolution_hours == null ? null : Number(Number(s.avg_resolution_hours).toFixed(1)) });
}));

// ---- Audit log ------------------------------------------------------------
auditRoutes.get('/', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const { rows } = await query('SELECT id, at, actor_name, action, target FROM audit_log ORDER BY at DESC LIMIT 200');
  res.json({ audit: rows.map((a) => ({ id: String(a.id), at: a.at, actor: a.actor_name, action: a.action, target: a.target })) });
}));

// ---- Public stats for the Impact page: real counts only; null when there is nothing to average ----
publicStats.get('/', wrap(async (_req, res) => {
  const { rows: cats } = await query("SELECT category, count(*)::int AS n FROM facilities WHERE NOT osm_gone GROUP BY category");
  const { rows: [t] } = await query(
    `SELECT count(*)::int AS facilities, count(DISTINCT country)::int AS countries,
            count(*) FILTER (WHERE ratings_count > 0)::int AS rated,
            (sum(rating * ratings_count) / NULLIF(sum(ratings_count), 0))::float AS avg_rating,
            count(*) FILTER (WHERE source = 'osm')::int AS from_osm
       FROM facilities WHERE NOT osm_gone`);
  const { rows: [r] } = await query("SELECT count(*)::int AS reports, count(*) FILTER (WHERE status = 'resolved')::int AS resolved FROM reports WHERE verified");
  res.json({ ...t, byCategory: Object.fromEntries(cats.map((c) => [c.category, c.n])), reportsVerified: r.reports, reportsResolved: r.resolved });
}));
