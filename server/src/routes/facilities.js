import { Router } from 'express';
import { query, tx } from '../db.js';
import { optionalAuth, requireAuth, requireRole, reporterKey } from '../middleware/auth.js';
import { wrap, bad, oneOf, num, HttpError } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { FACILITY_LITE, FACILITY_SELECT, FACILITY_FROM, toFacility } from '../lib/serialize.js';

const router = Router();
const CATEGORIES = ['toilet', 'water', 'waste', 'health'];
const MANAGERS = ['admin', 'municipality'];

export const canManage = (user, facility) =>
  user && (MANAGERS.includes(user.role) || (user.role === 'operator' && user.orgId && user.orgId === facility.owner_org_id));

async function getFacility(c, id) {
  const { rows } = await c.query('SELECT id, owner_org_id, category, status, name FROM facilities WHERE id = $1', [id]);
  return rows[0];
}

// Every facility a person interacts with must already exist: OpenStreetMap ones come only from the importer
// (`npm run import:facilities`), so an anonymous caller can never create rows with arbitrary content.
export async function ensureFacility(c, id) {
  const existing = await getFacility(c, id);
  if (!existing) throw new HttpError(404, 'Facility not found');
  return existing;
}

const fetchOne = async (c, id, extraSelect = '') => {
  const { rows } = await c.query(`SELECT ${FACILITY_SELECT}${extraSelect} FROM ${FACILITY_FROM} WHERE f.id = $1`, [id]);
  return rows[0] ? toFacility(rows[0]) : null;
};

// GET /api/facilities?lat=&lng=&radiusKm=&category=   — sorted by distance when a position is given
router.get('/', wrap(async (req, res) => {
  const params = [];
  const where = ['NOT f.osm_gone'];
  let dist = '';
  let order = 'f.id';
  if (req.query.lat !== undefined && req.query.lng !== undefined) {
    const lat = num(req.query.lat, 'lat', { min: -90, max: 90 });
    const lng = num(req.query.lng, 'lng', { min: -180, max: 180 });
    params.push(lng, lat);
    dist = `, ST_Distance(f.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m`;
    order = `f.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`;
    if (req.query.radiusKm !== undefined) {
      params.push(num(req.query.radiusKm, 'radiusKm', { min: 0, max: 500 }) * 1000);
      where.push(`ST_DWithin(f.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${params.length})`);
    }
  }
  if (req.query.category) {
    params.push(oneOf(req.query.category, CATEGORIES, 'category'));
    where.push(`f.category = $${params.length}`);
  }
  const sql = `SELECT ${FACILITY_LITE}${dist} FROM ${FACILITY_FROM} WHERE ${where.join(' AND ')} ORDER BY ${order}`;
  const { rows } = await query(sql, params);
  res.json({ facilities: rows.map(toFacility) });
}));

// GET /api/facilities/nearest?lat=&lng=&category=toilet&usable=1&limit=3
// This is also the query a USSD "nearest 3 facilities" menu would call.
router.get('/nearest', wrap(async (req, res) => {
  const lat = num(req.query.lat, 'lat', { min: -90, max: 90 });
  const lng = num(req.query.lng, 'lng', { min: -180, max: 180 });
  const params = [lng, lat];
  const where = ["NOT f.osm_gone", "f.access = 'public'"];
  if (req.query.category) {
    params.push(oneOf(req.query.category, CATEGORIES, 'category'));
    where.push(`f.category = $${params.length}`);
  }
  if (req.query.usable === '1') where.push(`f.status NOT IN ('broken', 'full', 'closed')`);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 3));
  const { rows } = await query(
    `SELECT ${FACILITY_LITE}, ST_Distance(f.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
       FROM ${FACILITY_FROM} WHERE ${where.join(' AND ')}
      ORDER BY f.geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography LIMIT ${limit}`,
    params
  );
  res.json({ facilities: rows.map(toFacility) });
}));

// Facilities an operator owns (full detail: usage counter, 7-day customers, photos). Municipality/admin: every owned one.
router.get('/mine', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  let where;
  let params = [];
  if (u.role === 'operator') { where = 'f.owner_org_id = $1'; params = [u.orgId]; }
  else if (MANAGERS.includes(u.role)) where = 'f.owner_org_id IS NOT NULL';
  else return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await query(`SELECT ${FACILITY_SELECT} FROM ${FACILITY_FROM} WHERE ${where} AND NOT f.osm_gone ORDER BY f.name`, params);
  res.json({ facilities: rows.map(toFacility) });
}));

// An operator takes responsibility for an existing (unowned) facility instead of registering a duplicate.
// Every claim is audit-logged; municipality / admin can release ownership.
router.post('/:id/claim', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'operator' || !req.user.orgId) throw new HttpError(403, 'Only facility operators can claim a facility');
  const facility = await tx(async (c) => {
    const { rows: [f] } = await c.query('SELECT id, name, owner_org_id FROM facilities WHERE id = $1 AND NOT osm_gone FOR UPDATE', [req.params.id]);
    if (!f) throw new HttpError(404, 'Not found');
    if (f.owner_org_id) throw new HttpError(409, 'This facility already has an operator');
    await c.query('UPDATE facilities SET owner_org_id = $2 WHERE id = $1', [f.id, req.user.orgId]);
    await audit(c, req.user, 'Claimed facility', f.name);
    return fetchOne(c, f.id);
  });
  res.json({ facility });
}));

router.post('/:id/release', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  const facility = await tx(async (c) => {
    const f = await getFacility(c, req.params.id);
    if (!f) throw new HttpError(404, 'Not found');
    await c.query('UPDATE facilities SET owner_org_id = NULL WHERE id = $1', [f.id]);
    await audit(c, req.user, 'Released facility ownership', f.name);
    return fetchOne(c, f.id);
  });
  res.json({ facility });
}));

router.get('/:id', wrap(async (req, res) => {
  const facility = await fetchOne({ query }, req.params.id);
  if (!facility) return res.status(404).json({ error: 'Not found' });
  res.json({ facility });
}));

router.post('/', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.category || !b.area || !b.country) throw bad('name, category, area and country are required');
  const category = oneOf(b.category, CATEGORIES, 'category');
  const lat = num(b.lat, 'lat', { min: -90, max: 90 });
  const lng = num(b.lng, 'lng', { min: -180, max: 180 });
  const isOperator = req.user.role === 'operator';
  const id = `usr-${category}-${Date.now().toString(36)}`;

  const facility = await tx(async (c) => {
    await c.query(
      `INSERT INTO facilities(id, category, name, area, country, geom, hours, description, status, fee, amenities, owner_org_id, source)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, $8, $9, 'unverified', $10, $11, $12, 'user')`,
      [id, category, String(b.name).trim().slice(0, 120), String(b.area).trim().slice(0, 120), String(b.country).trim().slice(0, 40),
       lat, lng, b.hours ? String(b.hours).slice(0, 120) : null, b.description ? String(b.description).slice(0, 500) : null,
       b.fee == null ? null : num(b.fee, 'fee', { min: 0, max: 100000 }), Array.isArray(b.amenities) ? b.amenities.slice(0, 10).map(String) : [],
       isOperator ? req.user.orgId : null]
    );
    await c.query('INSERT INTO facility_state(facility_id, capacity) VALUES ($1, 400)', [id]);
    await audit(c, req.user, 'Registered facility', String(b.name));
    return fetchOne(c, id);
  });
  res.status(201).json({ facility });
}));

// Operator (owner) / municipality / admin edits: price, hours, amenities, discount, photos.
router.patch('/:id', requireAuth, wrap(async (req, res) => {
  const facility = await tx(async (c) => {
    const f = await getFacility(c, req.params.id);
    if (!f) throw new HttpError(404, 'Not found');
    if (!canManage(req.user, f)) throw new HttpError(403, 'Forbidden');
    const b = req.body || {};
    const sets = [];
    const vals = [];
    const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (b.fee !== undefined) set('fee', num(b.fee, 'fee', { min: 0, max: 100000 }));
    if (b.hours !== undefined) set('hours', String(b.hours).slice(0, 120));
    if (b.amenities !== undefined) set('amenities', Array.isArray(b.amenities) ? b.amenities.slice(0, 10).map(String) : []);
    if (b.discount !== undefined) {
      set('discount_pct', b.discount ? num(b.discount.pct, 'discount.pct', { min: 0, max: 90 }) : null);
      set('discount_label', b.discount?.label ? String(b.discount.label).slice(0, 80) : null);
    }
    if (b.photos !== undefined) {
      if (!Array.isArray(b.photos) || b.photos.length > 8 || b.photos.some((p) => typeof p !== 'string' || p.length > 400000)) throw bad('photos must be up to 8 images');
      set('photos', b.photos);
    }
    if (b.licensed !== undefined && MANAGERS.includes(req.user.role)) set('licensed', Boolean(b.licensed));
    if (!sets.length) throw bad('nothing to update');
    vals.push(f.id);
    await c.query(`UPDATE facilities SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    await audit(c, req.user, 'Updated facility', f.name);
    return fetchOne(c, f.id);
  });
  res.json({ facility });
}));

router.post('/:id/cleaned', requireAuth, wrap(async (req, res) => {
  const facility = await tx(async (c) => {
    const f = await getFacility(c, req.params.id);
    if (!f) throw new HttpError(404, 'Not found');
    if (!canManage(req.user, f)) throw new HttpError(403, 'Forbidden');
    await c.query('INSERT INTO facility_state(facility_id, last_cleaned_at) VALUES ($1, now()) ON CONFLICT (facility_id) DO UPDATE SET last_cleaned_at = now()', [f.id]);
    if (f.status === 'dirty') await c.query("UPDATE facilities SET status = 'clean' WHERE id = $1", [f.id]);
    await c.query("UPDATE reports SET status = 'resolved', resolved_at = now() WHERE facility_id = $1 AND type = 'dirty' AND status <> 'resolved'", [f.id]);
    await audit(c, req.user, 'Marked facility cleaned', f.name);
    return fetchOne(c, f.id);
  });
  res.json({ facility });
}));

// Usage counter (drives the fill-level alert). A sensor ingest endpoint with a device key can reuse this later.
router.post('/:id/usage', requireAuth, wrap(async (req, res) => {
  const n = num(req.body?.visits ?? 1, 'visits', { min: 1, max: 500 });
  const facility = await tx(async (c) => {
    const f = await getFacility(c, req.params.id);
    if (!f) throw new HttpError(404, 'Not found');
    if (!canManage(req.user, f)) throw new HttpError(403, 'Forbidden');
    await c.query('INSERT INTO facility_state(facility_id, usage_count) VALUES ($1, $2) ON CONFLICT (facility_id) DO UPDATE SET usage_count = facility_state.usage_count + $2', [f.id, n]);
    await c.query('INSERT INTO facility_daily(facility_id, day, customers) VALUES ($1, current_date, $2) ON CONFLICT (facility_id, day) DO UPDATE SET customers = facility_daily.customers + $2', [f.id, n]);
    return fetchOne(c, f.id);
  });
  res.json({ facility });
}));

// One rating per person per facility; rating again replaces their previous stars.
router.post('/:id/rate', optionalAuth, wrap(async (req, res) => {
  const stars = num(req.body?.stars, 'stars', { min: 1, max: 5 });
  if (!Number.isInteger(stars)) throw bad('stars must be a whole number');
  const key = reporterKey(req);
  const facility = await tx(async (c) => {
    await ensureFacility(c, req.params.id);
    const { rows: [f] } = await c.query('SELECT rating::float AS rating, ratings_count FROM facilities WHERE id = $1 FOR UPDATE', [req.params.id]);
    const { rows: [prev] } = await c.query('SELECT stars FROM ratings WHERE facility_id = $1 AND user_key = $2', [req.params.id, key]);
    let rating;
    let count = f.ratings_count;
    if (prev) {
      rating = (f.rating * count - prev.stars + stars) / count;
    } else {
      rating = (f.rating * count + stars) / (count + 1);
      count += 1;
    }
    await c.query(
      `INSERT INTO ratings(facility_id, user_key, stars) VALUES ($1, $2, $3)
       ON CONFLICT (facility_id, user_key) DO UPDATE SET stars = $3, created_at = now()`,
      [req.params.id, key, stars]
    );
    await c.query('UPDATE facilities SET rating = $2, ratings_count = $3 WHERE id = $1', [req.params.id, Number(rating.toFixed(2)), count]);
    return fetchOne(c, req.params.id);
  });
  res.json({ facility });
}));

// "Is this water point working today?" A lone "yes" cannot un-break a facility: two different
// people must confirm within 24 h before a broken/seasonal point flips back to operational.
router.post('/:id/confirm', optionalAuth, wrap(async (req, res) => {
  const working = Boolean(req.body?.working);
  const key = reporterKey(req);
  const out = await tx(async (c) => {
    const f = await ensureFacility(c, req.params.id);
    await c.query('INSERT INTO confirmations(facility_id, reporter_key, working) VALUES ($1, $2, $3)', [f.id, key, working]);
    await c.query(
      `INSERT INTO facility_state(facility_id, last_confirmed_at, last_confirmed_working) VALUES ($1, now(), $2)
       ON CONFLICT (facility_id) DO UPDATE SET last_confirmed_at = now(), last_confirmed_working = $2`,
      [f.id, working]
    );
    let flipped = false;
    if (working && ['broken', 'seasonal', 'unverified'].includes(f.status)) {
      const { rows: [{ n }] } = await c.query(
        "SELECT count(DISTINCT reporter_key) AS n FROM confirmations WHERE facility_id = $1 AND working AND created_at > now() - interval '24 hours'", [f.id]);
      if (n >= 2) {
        await c.query("UPDATE facilities SET status = 'operational' WHERE id = $1", [f.id]);
        await c.query('UPDATE facility_state SET broken_since = NULL WHERE facility_id = $1', [f.id]);
        flipped = true;
      }
    }
    return { flipped, facility: await fetchOne(c, f.id) };
  });
  res.json(out);
}));

export default router;
