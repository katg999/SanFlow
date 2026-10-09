import { Router } from 'express';
import { query, tx } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap, bad, num, HttpError } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { JOB_SELECT, toJob } from '../lib/serialize.js';

const router = Router();
const KIND_JOBS = { 'Sewage exhauster': ['pit'], 'Waste collector': ['waste'], 'Water point repair': ['water'] };
const isPhoto = (p) => typeof p === 'string' && p.startsWith('data:image/') && p.length <= 400000;

// Before/after photos for one job (receipts) — kept out of the list because they are large.
router.get('/:id/photos', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  const { rows: [j] } = await query(
    `SELECT j.before_photo, j.after_photo, j.provider_id, f.owner_org_id FROM jobs j LEFT JOIN facilities f ON f.id = j.facility_id WHERE j.id = $1`, [req.params.id]);
  const allowed = j && (['municipality', 'admin'].includes(u.role) || (u.orgId && (u.orgId === j.provider_id || u.orgId === j.owner_org_id)));
  if (!allowed) return res.status(404).json({ error: 'Not found' });
  res.json({ before: j.before_photo, after: j.after_photo });
}));

router.get('/', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  let rows;
  if (u.role === 'provider') {
    const { rows: [org] } = await query('SELECT zone, provider_kind FROM organisations WHERE id = $1', [u.orgId]);
    const types = KIND_JOBS[org?.provider_kind] ?? ['pit', 'waste', 'water'];
    // their own jobs, plus unassigned open jobs in their zone for the kinds of work they do
    ({ rows } = await query(
      `SELECT ${JOB_SELECT} FROM jobs j WHERE j.type = ANY($3) AND (j.provider_id = $1 OR (j.provider_id IS NULL AND j.status = 'open' AND j.zone = $2))
       ORDER BY j.created_at DESC LIMIT 500`, [u.orgId, org?.zone ?? 'Nairobi', types]));
  } else if (u.role === 'operator') {
    ({ rows } = await query(
      `SELECT ${JOB_SELECT} FROM jobs j WHERE j.facility_id IN (SELECT id FROM facilities WHERE owner_org_id = $1) ORDER BY j.created_at DESC LIMIT 500`, [u.orgId]));
  } else if (u.role === 'municipality' || u.role === 'admin') {
    ({ rows } = await query(`SELECT ${JOB_SELECT} FROM jobs j ORDER BY j.created_at DESC LIMIT 1000`));
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ jobs: rows.map(toJob) });
}));

// Operator asks for an exhauster for one of their own facilities.
router.post('/pickup', requireAuth, requireRole('operator', 'admin', 'municipality'), wrap(async (req, res) => {
  const job = await tx(async (c) => {
    const { rows: [f] } = await c.query(
      `SELECT id, name, category, owner_org_id, country, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng FROM facilities WHERE id = $1`, [req.body?.facilityId]);
    if (!f) throw new HttpError(404, 'Facility not found');
    if (req.user.role === 'operator' && f.owner_org_id !== req.user.orgId) throw new HttpError(403, 'Forbidden');
    const dup = await c.query("SELECT 1 FROM jobs WHERE facility_id = $1 AND type = $2 AND status <> 'done'", [f.id, f.category === 'waste' ? 'waste' : 'pit']);
    if (dup.rowCount) throw new HttpError(409, 'A pickup is already open for this facility');
    const { rows: [w] } = await c.query('SELECT city FROM wards ORDER BY center <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography LIMIT 1', [f.lng, f.lat]);
    const { rows: [j] } = await c.query(
      `INSERT INTO jobs(type, facility_id, geom, priority, zone) VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'high', $5) RETURNING id`,
      [f.category === 'waste' ? 'waste' : 'pit', f.id, f.lng, f.lat, w?.city ?? 'Nairobi']);
    await audit(c, req.user, 'Requested exhauster', f.name);
    const { rows: [row] } = await c.query(`SELECT ${JOB_SELECT} FROM jobs j WHERE j.id = $1`, [j.id]);
    return toJob(row);
  });
  res.status(201).json({ job });
}));

router.post('/:id/accept', requireAuth, requireRole('provider'), wrap(async (req, res) => {
  const job = await tx(async (c) => {
    const { rows: [j] } = await c.query('SELECT id, status, provider_id FROM jobs WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!j) throw new HttpError(404, 'Not found');
    if (j.status !== 'open') throw new HttpError(409, 'Job is no longer open');
    if (j.provider_id && j.provider_id !== req.user.orgId) throw new HttpError(403, 'Assigned to another provider');
    await c.query("UPDATE jobs SET status = 'accepted', provider_id = $2 WHERE id = $1", [j.id, req.user.orgId]);
    await audit(c, req.user, 'Accepted job', j.id);
    const { rows: [row] } = await c.query(`SELECT ${JOB_SELECT} FROM jobs j WHERE j.id = $1`, [j.id]);
    return toJob(row);
  });
  res.json({ job });
}));

// Completion needs before/after photos, then issues the digital receipt number.
router.post('/:id/complete', requireAuth, requireRole('provider'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isPhoto(b.before) || !isPhoto(b.after)) throw bad('before and after photos are required (image data URLs under ~300 KB)');
  const job = await tx(async (c) => {
    const { rows: [j] } = await c.query('SELECT id, type, status, provider_id, facility_id, report_id FROM jobs WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!j) throw new HttpError(404, 'Not found');
    if (j.provider_id !== req.user.orgId) throw new HttpError(403, 'Not your job');
    if (j.status !== 'accepted') throw new HttpError(409, 'Accept the job before completing it');
    const volume = j.type === 'water' ? 0 : num(b.volumeM3, 'volumeM3', { min: 0, max: 1000 });
    const amount = num(b.amountKES, 'amountKES', { min: 0, max: 100000000 });
    let destination = null;
    // The treatment partner is optional: only volume delivered to a registered partner counts as "treated".
    if (j.type !== 'water' && b.destination) {
      const { rowCount } = await c.query('SELECT 1 FROM treatment_partners WHERE id = $1', [b.destination]);
      if (!rowCount) throw bad('destination must be a registered treatment partner');
      destination = b.destination;
    }
    const { rows: [{ n }] } = await c.query("SELECT nextval('receipt_seq') AS n");
    await c.query(
      `UPDATE jobs SET status = 'done', completed_at = now(), volume_m3 = $2, amount_kes = $3, destination = $4,
              before_photo = $5, after_photo = $6, receipt_no = $7 WHERE id = $1`,
      [j.id, volume, amount, destination, b.before, b.after, `RCP-${n}`]);
    if (j.report_id) await c.query("UPDATE reports SET status = 'resolved', resolved_at = now() WHERE id = $1 AND status <> 'resolved'", [j.report_id]);
    if (j.facility_id && j.type === 'pit') await c.query('UPDATE facility_state SET usage_count = 0 WHERE facility_id = $1', [j.facility_id]); // emptied pit starts at zero
    if (j.facility_id && j.type === 'water') {
      await c.query("UPDATE facilities SET status = 'operational' WHERE id = $1 AND status = 'broken'", [j.facility_id]);
      await c.query('UPDATE facility_state SET broken_since = NULL WHERE facility_id = $1', [j.facility_id]);
    }
    await audit(c, req.user, 'Completed job', `${j.id} (RCP-${n})`);
    const { rows: [row] } = await c.query(`SELECT ${JOB_SELECT} FROM jobs j WHERE j.id = $1`, [j.id]);
    return toJob(row);
  });
  res.json({ job });
}));

export default router;
