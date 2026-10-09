import { Router } from 'express';
import { query, tx } from '../db.js';
import { optionalAuth, requireAuth, requireRole, reporterKey } from '../middleware/auth.js';
import { wrap, bad, oneOf, num, HttpError, rateLimit } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { evaluateReport, jobTypeFor, STATUS_FOR_TYPE, DAY_MS } from '../lib/verification.js';
import { REPORT_SELECT, toReport } from '../lib/serialize.js';
import { ensureFacility } from './facilities.js';

const router = Router();
const TYPES = ['broken', 'full', 'dirty', 'dumping'];
const SEVERITY = { broken: 4, closed: 4, full: 3, filling: 2, dirty: 1, seasonal: 1 };
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

async function zoneFor(c, lat, lng, fallback = 'Nairobi') {
  if (lat == null) return fallback;
  const { rows } = await c.query(
    'SELECT city FROM wards ORDER BY center <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography LIMIT 1', [lng, lat]);
  return rows[0]?.city ?? fallback;
}

router.post('/', limiter, optionalAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const type = oneOf(b.type, TYPES, 'type');
  const note = String(b.note ?? '').slice(0, 1000);
  let photo = b.photo ?? null;
  if (photo && (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 400000)) {
    throw bad('photo must be an image data URL under ~300 KB');
  }
  const gps = b.lat != null && b.lng != null
    ? { lat: num(b.lat, 'lat', { min: -90, max: 90 }), lng: num(b.lng, 'lng', { min: -180, max: 180 }) }
    : null;
  if (!b.facilityId && !(type === 'dumping' && gps)) throw bad('facilityId is required (dumping reports need a GPS pin)');

  const key = reporterKey(req);
  const out = await tx(async (c) => {
    const facility = b.facilityId ? await ensureFacility(c, b.facilityId) : null;

    let distanceM = null;
    if (facility && gps) {
      const { rows } = await c.query('SELECT ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS d FROM facilities WHERE id = $1', [facility.id, gps.lng, gps.lat]);
      distanceM = rows[0].d;
    }

    const since = new Date(Date.now() - DAY_MS);
    const { rows: recent } = facility
      ? await c.query("SELECT reporter_key, weight FROM reports WHERE facility_id = $1 AND type = $2 AND status <> 'resolved' AND created_at > $3", [facility.id, type, since])
      : await c.query(
          `SELECT reporter_key, weight FROM reports WHERE type = 'dumping' AND created_at > $1 AND reporter_key = $2
             AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 100)`, [since, key, gps.lng, gps.lat]);

    const verdict = evaluateReport({ hasFacility: Boolean(facility), type, reporterKey: key, distanceM, recent });
    if (verdict.duplicate) return { ok: false, code: 'duplicate', verified: false };

    const insertParams = [facility?.id ?? null, type, note, photo, key, req.user?.name ?? 'Anonymous', verdict.weight, verdict.verified];
    let geomSql = 'NULL';
    if (gps) {
      insertParams.push(gps.lng, gps.lat);
      geomSql = 'ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography';
    }
    const { rows: [report] } = await c.query(
      `INSERT INTO reports(facility_id, type, note, photo, geom, reporter_key, reporter_name, weight, verified)
       VALUES ($1, $2, $3, $4, ${geomSql}, $5, $6, $7, $8) RETURNING id`,
      insertParams
    );
    const lat = gps?.lat ?? null;
    const lng = gps?.lng ?? null;

    if (verdict.verified) {
      if (facility) {
        // earlier unconfirmed reports about the same problem are now corroborated
        await c.query("UPDATE reports SET verified = true WHERE facility_id = $1 AND type = $2 AND status = 'new' AND created_at > $3", [facility.id, type, since]);
        const next = STATUS_FOR_TYPE[type];
        if (next && (SEVERITY[next] ?? 0) >= (SEVERITY[facility.status] ?? 0)) {
          await c.query('UPDATE facilities SET status = $2 WHERE id = $1', [facility.id, next]);
          if (next === 'broken') await c.query('INSERT INTO facility_state(facility_id, broken_since) VALUES ($1, now()) ON CONFLICT (facility_id) DO UPDATE SET broken_since = coalesce(facility_state.broken_since, now())', [facility.id]);
        }
      }
      const jobType = jobTypeFor({ type, category: facility?.category });
      if (jobType) {
        let zone;
        let jlat = lat;
        let jlng = lng;
        if (facility) {
          const { rows: [g] } = await c.query('SELECT ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng FROM facilities WHERE id = $1', [facility.id]);
          jlat = g.lat; jlng = g.lng;
        }
        zone = await zoneFor(c, jlat, jlng);
        const open = facility && (await c.query("SELECT 1 FROM jobs WHERE facility_id = $1 AND type = $2 AND status <> 'done'", [facility.id, jobType])).rowCount;
        if (!open) {
          await c.query(
            `INSERT INTO jobs(type, facility_id, report_id, geom, priority, zone) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7)`,
            [jobType, facility?.id ?? null, report.id, jlng, jlat, type === 'full' ? 'high' : 'medium', zone]
          );
        }
      }
    }
    return { ok: true, code: verdict.verified ? 'verified' : 'pending', verified: verdict.verified, id: report.id };
  });
  res.status(out.ok ? 201 : 200).json(out);
}));

// Who sees what: municipality/admin everything; operators their facilities; providers what is
// assigned to them; citizens their own reports.
function scopeFor(u) {
  if (u.role === 'operator') return { where: 'r.facility_id IN (SELECT id FROM facilities WHERE owner_org_id = $1)', params: [u.orgId] };
  if (u.role === 'provider') return { where: 'r.assigned_id = $1', params: [u.orgId] };
  if (u.role === 'citizen') return { where: 'r.reporter_key = $1', params: [u.id] };
  return { where: 'TRUE', params: [] };
}

// Photos are not included in lists (they are large) — fetch one with GET /api/reports/:id/photo.
router.get('/', requireAuth, wrap(async (req, res) => {
  const { where, params } = scopeFor(req.user);
  const { rows } = await query(`SELECT ${REPORT_SELECT} FROM reports r WHERE ${where} ORDER BY r.created_at DESC LIMIT 500`, params);
  res.json({ reports: rows.map(toReport) });
}));

router.get('/:id/photo', requireAuth, wrap(async (req, res) => {
  const { where, params } = scopeFor(req.user);
  const { rows } = await query(`SELECT r.photo FROM reports r WHERE r.id = $${params.length + 1} AND ${where}`, [...params, req.params.id]);
  if (!rows[0]?.photo) return res.status(404).json({ error: 'Not found' });
  res.json({ photo: rows[0].photo });
}));

router.post('/:id/assign', requireAuth, requireRole('municipality', 'admin'), wrap(async (req, res) => {
  const { kind, id } = req.body || {};
  oneOf(kind, ['provider', 'operator'], 'kind');
  const out = await tx(async (c) => {
    const { rows: [org] } = await c.query('SELECT id, name, zone FROM organisations WHERE id = $1 AND kind = $2', [id, kind]);
    if (!org) throw bad(`unknown ${kind}`);
    const { rows: [r] } = await c.query('SELECT r.*, f.category, ST_Y(coalesce(f.geom, r.geom)::geometry) AS lat, ST_X(coalesce(f.geom, r.geom)::geometry) AS lng FROM reports r LEFT JOIN facilities f ON f.id = r.facility_id WHERE r.id = $1 FOR UPDATE OF r', [req.params.id]);
    if (!r) throw new HttpError(404, 'Not found');
    await c.query("UPDATE reports SET status = 'assigned', assigned_kind = $2, assigned_id = $3, assigned_name = $4 WHERE id = $1 AND status <> 'resolved'", [r.id, kind, org.id, org.name]);
    if (kind === 'provider') {
      const jobType = jobTypeFor({ type: r.type, category: r.category }) ?? (r.category === 'waste' ? 'waste' : 'pit');
      const upd = await c.query('UPDATE jobs SET provider_id = $2 WHERE report_id = $1 AND status <> \'done\'', [r.id, org.id]);
      if (!upd.rowCount) {
        await c.query('INSERT INTO jobs(type, facility_id, report_id, geom, zone, provider_id) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7)',
          [jobType, r.facility_id, r.id, r.lng, r.lat, org.zone, org.id]);
      }
    }
    await audit(c, req.user, 'Assigned report', `${r.id} → ${org.name}`);
    const { rows: [fresh] } = await c.query(`SELECT ${REPORT_SELECT} FROM reports r WHERE r.id = $1`, [r.id]);
    return toReport(fresh);
  });
  res.json({ report: out });
}));

router.post('/:id/resolve', requireAuth, wrap(async (req, res) => {
  const out = await tx(async (c) => {
    const { rows: [r] } = await c.query('SELECT r.id, r.assigned_id, f.owner_org_id FROM reports r LEFT JOIN facilities f ON f.id = r.facility_id WHERE r.id = $1 FOR UPDATE OF r', [req.params.id]);
    if (!r) throw new HttpError(404, 'Not found');
    const u = req.user;
    const allowed = ['municipality', 'admin'].includes(u.role) || (u.orgId && (u.orgId === r.owner_org_id || u.orgId === r.assigned_id));
    if (!allowed) throw new HttpError(403, 'Forbidden');
    await c.query("UPDATE reports SET status = 'resolved', resolved_at = now() WHERE id = $1 AND status <> 'resolved'", [r.id]);
    await audit(c, u, 'Resolved report', r.id);
    const { rows: [fresh] } = await c.query(`SELECT ${REPORT_SELECT} FROM reports r WHERE r.id = $1`, [r.id]);
    return toReport(fresh);
  });
  res.json({ report: out });
}));

export default router;
