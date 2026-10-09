import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL || 'postgres://sanflow:sanflow@127.0.0.1:54329/sanflow';
const TEST_URL = ADMIN_URL.replace(/\/[^/]+$/, '/sanflow_test');
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

let server;
let base;
let pool;
const tokens = {};
let FIXTURE_PASSWORD;

const call = async (method, path, { token, body, headers } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = 'sanflow_test'")).rowCount) await admin.query('CREATE DATABASE sanflow_test');
  await admin.end();

  process.env.DATABASE_URL = TEST_URL;
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
  const { seed, FIXTURE_PASSWORD: fp } = await import('./fixtures.js');
  FIXTURE_PASSWORD = fp;
  await seed({ reset: true });
  ({ pool } = await import('../src/db.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const emails = { citizen: 'citizen', operator: 'operator', provider: 'provider', municipality: 'county', admin: 'admin' };
  for (const [role, local] of Object.entries(emails)) {
    tokens[role] = (await call('POST', '/api/auth/login', { body: { email: `${local}@fixture.test`, password: FIXTURE_PASSWORD } })).data.token;
  }
});

after(async () => {
  server?.close();
  await pool?.end();
});

test('health reports a live database', async () => {
  const { status, data } = await call('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(data.db, true);
});

test('nearest usable toilet skips broken/full/closed ones (PostGIS KNN)', async () => {
  // standing on top of the broken Mukuru toilet: it must not be recommended
  const { data } = await call('GET', '/api/facilities/nearest?lat=-1.3106&lng=36.8767&category=toilet&usable=1&limit=3');
  assert.ok(data.facilities.length > 0);
  assert.ok(data.facilities.every((f) => !['broken', 'full', 'closed'].includes(f.status)));
  assert.ok(!data.facilities.some((f) => f.id === 'ke-tlt-003'));
  const d = data.facilities.map((f) => f.distanceM);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));
});

test('facility list can be filtered by radius', async () => {
  const { data } = await call('GET', '/api/facilities?lat=0.3136&lng=32.5811&radiusKm=5&category=toilet');
  assert.ok(data.facilities.length >= 1);
  assert.ok(data.facilities.every((f) => f.country === 'Uganda'));
});

test('role guards: anonymous 401, wrong role 403', async () => {
  assert.equal((await call('GET', '/api/users')).status, 401);
  assert.equal((await call('GET', '/api/users', { token: tokens.citizen })).status, 403);
  assert.equal((await call('GET', '/api/users', { token: tokens.admin })).status, 200);
  assert.equal((await call('GET', '/api/analytics/wards', { token: tokens.operator })).status, 403);
  assert.equal((await call('POST', '/api/notices', { token: tokens.citizen, body: { title: 'x', body: 'y' } })).status, 403);
});

test('self-service registration cannot grant admin', async () => {
  const r = await call('POST', '/api/auth/register', { body: { name: 'Eve', email: 'eve@example.com', password: 'longenough1', role: 'admin' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'citizen');
  const dup = await call('POST', '/api/auth/register', { body: { name: 'Eve', email: 'EVE@example.com', password: 'longenough1' } });
  assert.equal(dup.status, 409);
  const weak = await call('POST', '/api/auth/register', { body: { name: 'W', email: 'w@example.com', password: 'short' } });
  assert.equal(weak.status, 400);
});

test('operator registration creates an organisation that can own facilities', async () => {
  const r = await call('POST', '/api/auth/register', { body: { name: 'New Op', email: 'newop@example.com', password: 'longenough1', role: 'operator' } });
  assert.equal(r.data.user.role, 'operator');
  assert.ok(r.data.user.orgId);
  const f = await call('POST', '/api/facilities', { token: r.data.token, body: { name: 'Gikomba Toilet', category: 'toilet', area: 'Gikomba, Nairobi', country: 'Kenya', lat: -1.285, lng: 36.84, fee: 10 } });
  assert.equal(f.status, 201);
  assert.equal(f.data.facility.ownerId, r.data.user.orgId);
  // another operator cannot edit it, its owner can
  assert.equal((await call('PATCH', `/api/facilities/${f.data.facility.id}`, { token: tokens.operator, body: { fee: 1 } })).status, 403);
  assert.equal((await call('PATCH', `/api/facilities/${f.data.facility.id}`, { token: r.data.token, body: { fee: 15, discount: { pct: 10 } } })).data.facility.fee, 15);
});

test('report verification: far report waits, duplicates rejected, corroboration flips status', async () => {
  const dev = (id) => ({ 'X-Device-Id': id });
  const far = { facilityId: 'ug-tlt-001', type: 'broken', lat: 0.5, lng: 32.9 }; // ~35 km away -> weight 0.4
  const a = await call('POST', '/api/reports', { body: far, headers: dev('d1') });
  assert.equal(a.data.code, 'pending');
  assert.equal((await call('POST', '/api/reports', { body: far, headers: dev('d1') })).data.code, 'duplicate');
  assert.equal((await call('GET', '/api/facilities/ug-tlt-001')).data.facility.status, 'clean');
  await call('POST', '/api/reports', { body: far, headers: dev('d2') });
  const c = await call('POST', '/api/reports', { body: far, headers: dev('d3') });
  assert.equal(c.data.code, 'verified');
  assert.equal((await call('GET', '/api/facilities/ug-tlt-001')).data.facility.status, 'broken');
});

test('a nearby report verifies at once, flips status and raises a provider job', async () => {
  const r = await call('POST', '/api/reports', { body: { facilityId: 'ke-tlt-004', type: 'full', lat: -1.2822, lng: 36.8267, note: 'overflowing', photo: PHOTO }, headers: { 'X-Device-Id': 'near1' } });
  assert.equal(r.data.code, 'verified');
  assert.equal((await call('GET', '/api/facilities/ke-tlt-004')).data.facility.status, 'full');
  const jobs = await call('GET', '/api/jobs', { token: tokens.municipality });
  assert.ok(jobs.data.jobs.some((j) => j.facilityId === 'ke-tlt-004' && j.type === 'pit'));
});

test('invalid reports are rejected', async () => {
  assert.equal((await call('POST', '/api/reports', { body: { type: 'nonsense', facilityId: 'ke-tlt-001' } })).status, 400);
  assert.equal((await call('POST', '/api/reports', { body: { type: 'broken' } })).status, 400);
  assert.equal((await call('POST', '/api/reports', { body: { type: 'dumping' } })).status, 400);
  assert.equal((await call('POST', '/api/reports', { body: { type: 'broken', facilityId: 'ke-tlt-001', photo: 'http://evil/x.png' } })).status, 400);
  assert.equal((await call('POST', '/api/reports', { body: { type: 'broken', facilityId: 'nope' } })).status, 404);
});

test('nobody can create facilities by interacting with ids that do not exist (no client-made OSM rows)', async () => {
  const snap = { category: 'toilet', name: 'Spoofed', lat: 0.31, lng: 32.58 };
  assert.equal((await call('POST', '/api/facilities/osm-node-42/rate', { body: { stars: 4, facility: snap }, headers: { 'X-Device-Id': 'r1' } })).status, 404);
  assert.equal((await call('POST', '/api/reports', { body: { type: 'broken', facilityId: 'osm-node-42', facility: snap } })).status, 404);
  assert.equal((await call('POST', '/api/facilities/osm-node-42/confirm', { body: { working: true, facility: snap } })).status, 404);
});

test('one rating per person: rating again replaces, it does not add', async () => {
  const h = { 'X-Device-Id': 'rater-x' };
  const first = await call('POST', '/api/facilities/ke-tlt-001/rate', { body: { stars: 5 }, headers: h });
  const again = await call('POST', '/api/facilities/ke-tlt-001/rate', { body: { stars: 1 }, headers: h });
  assert.equal(again.data.facility.ratingsCount, first.data.facility.ratingsCount);
  assert.ok(again.data.facility.rating < first.data.facility.rating);
  assert.equal((await call('POST', '/api/facilities/ke-tlt-001/rate', { body: { stars: 9 }, headers: h })).status, 400);
});

test('one "working" confirmation cannot un-break a water point; two people can', async () => {
  const id = 'ke-wtr-002'; // seeded broken
  const a = await call('POST', `/api/facilities/${id}/confirm`, { body: { working: true }, headers: { 'X-Device-Id': 'c1' } });
  assert.equal(a.data.flipped, false);
  assert.equal(a.data.facility.status, 'broken');
  const b = await call('POST', `/api/facilities/${id}/confirm`, { body: { working: true }, headers: { 'X-Device-Id': 'c2' } });
  assert.equal(b.data.flipped, true);
  assert.equal(b.data.facility.status, 'operational');
});

test('provider job lifecycle: accept -> complete needs photos -> receipt, resolves the report, resets the pit', async () => {
  const { data } = await call('GET', '/api/jobs', { token: tokens.provider });
  const job = data.jobs.find((j) => j.facilityId === 'ke-tlt-002' && j.status === 'open');
  assert.ok(job, 'provider sees the open job for Toi Market');
  assert.equal((await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { before: PHOTO, after: PHOTO, volumeM3: 6, amountKES: 9000, destination: 't-biogas' } })).status, 409);
  assert.equal((await call('POST', `/api/jobs/${job.id}/accept`, { token: tokens.operator })).status, 403);
  assert.equal((await call('POST', `/api/jobs/${job.id}/accept`, { token: tokens.provider })).status, 200);
  assert.equal((await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { volumeM3: 6, amountKES: 9000, destination: 't-biogas' } })).status, 400);
  assert.equal((await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { before: PHOTO, after: PHOTO, volumeM3: 6, amountKES: 9000, destination: 'bogus' } })).status, 400);
  const done = await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { before: PHOTO, after: PHOTO, volumeM3: 6, amountKES: 9000, destination: 't-biogas' } });
  assert.equal(done.status, 200);
  assert.match(done.data.job.receiptNo, /^RCP-\d+$/);
  assert.equal((await call('GET', '/api/facilities/ke-tlt-002')).data.facility.usage, 0);
  const again = await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { before: PHOTO, after: PHOTO, volumeM3: 6, amountKES: 9000, destination: 't-biogas' } });
  assert.equal(again.status, 409);
});

test('operator sees only their own facilities\' reports and jobs', async () => {
  const { data } = await call('GET', '/api/reports', { token: tokens.operator });
  const own = new Set(['ke-tlt-001', 'ke-tlt-002', 'ke-tlt-003']);
  assert.ok(data.reports.length > 0);
  assert.ok(data.reports.every((r) => own.has(r.facilityId)));
  const jobs = await call('GET', '/api/jobs', { token: tokens.operator });
  assert.ok(jobs.data.jobs.every((j) => own.has(j.facilityId)));
});

test('municipality assigns a report to a provider, which creates the job; operators may not assign', async () => {
  const reports = (await call('GET', '/api/reports', { token: tokens.municipality })).data.reports;
  const target = reports.find((r) => r.facilityId === 'ug-wst-001' && r.status === 'new');
  assert.equal((await call('POST', `/api/reports/${target.id}/assign`, { token: tokens.operator, body: { kind: 'provider', id: 'p-sewercare' } })).status, 403);
  assert.equal((await call('POST', `/api/reports/${target.id}/assign`, { token: tokens.municipality, body: { kind: 'provider', id: 'nope' } })).status, 400);
  const ok = await call('POST', `/api/reports/${target.id}/assign`, { token: tokens.municipality, body: { kind: 'provider', id: 'p-sewercare' } });
  assert.equal(ok.data.report.status, 'assigned');
  assert.equal(ok.data.report.assignedTo.name, 'Kampala SewerCare');
  const res = await call('POST', `/api/reports/${target.id}/resolve`, { token: tokens.municipality });
  assert.equal(res.data.report.status, 'resolved');
  assert.ok(res.data.report.resolvedAt);
});

test('ward gap analysis matches the brief: Mukuru has 12,000 people and needs 12 toilets', async () => {
  const { data } = await call('GET', '/api/analytics/wards', { token: tokens.municipality });
  const mukuru = data.wards.find((w) => w.id === 'w-mukuru');
  assert.equal(mukuru.population, 12000);
  assert.equal(mukuru.required, 12);
  assert.equal(mukuru.working, 0); // its only toilet is broken
  assert.equal(mukuru.gap, 12);
  assert.equal(mukuru.coveragePct, 0);
});

test('bulk notice computes reach from ward population and is public to read', async () => {
  const sent = await call('POST', '/api/notices', { token: tokens.municipality, body: { title: 'Chlorination', body: 'Tomorrow 8 AM', area: 'Kibera', sms: true, app: true } });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.notice.sent, 5200);
  assert.equal(sent.data.notice.channel, 'SMS + App');
  const list = await call('GET', '/api/notices');
  assert.equal(list.data.notices[0].title, 'Chlorination');
});

test('admin can change roles and suspend; suspended users lose access immediately; cannot edit self', async () => {
  const users = (await call('GET', '/api/users', { token: tokens.admin })).data.users;
  const eve = users.find((u) => u.email === 'eve@example.com');
  const evel = await call('POST', '/api/auth/login', { body: { email: 'eve@example.com', password: 'longenough1' } });
  assert.equal((await call('GET', '/api/auth/me', { token: evel.data.token })).status, 200);
  const sus = await call('PATCH', `/api/users/${eve.id}`, { token: tokens.admin, body: { active: false } });
  assert.equal(sus.data.user.active, false);
  assert.equal((await call('GET', '/api/auth/me', { token: evel.data.token })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'eve@example.com', password: 'longenough1' } })).status, 403);
  const me = users.find((u) => u.role === 'admin' && u.email.startsWith('admin@'));
  assert.equal((await call('PATCH', `/api/users/${me.id}`, { token: tokens.admin, body: { role: 'citizen' } })).status, 400);
  assert.equal((await call('PATCH', `/api/users/${eve.id}`, { token: tokens.admin, body: { role: 'wizard' } })).status, 400);
});

test('audit log records mutations (admin only)', async () => {
  assert.equal((await call('GET', '/api/audit', { token: tokens.municipality })).status, 403);
  const { data } = await call('GET', '/api/audit', { token: tokens.admin });
  const actions = data.audit.map((a) => a.action);
  assert.ok(actions.includes('Completed job'));
  assert.ok(actions.includes('Assigned report'));
  assert.ok(actions.includes('Updated user'));
});

test('summary reports delivered volume only — no invented climate factor', async () => {
  const { data } = await call('GET', '/api/analytics/summary', { token: tokens.municipality });
  assert.ok(data.m3_to_treatment >= 33); // 6+8+12+7 fixture volumes, plus the job completed above
  assert.equal(data.co2e_avoided_tonnes, undefined);
});

test('operators claim unowned facilities; a second claim is refused; municipality can release', async () => {
  const claimed = await call('POST', '/api/facilities/ug-tlt-002/claim', { token: tokens.operator });
  assert.equal(claimed.status, 200);
  assert.ok(claimed.data.facility.ownerId);
  assert.equal((await call('POST', '/api/facilities/ug-tlt-002/claim', { token: tokens.operator })).status, 409);
  assert.equal((await call('POST', '/api/facilities/ug-tlt-002/claim', { token: tokens.citizen })).status, 403);
  assert.equal((await call('POST', '/api/facilities/ug-tlt-002/release', { token: tokens.operator })).status, 403);
  assert.equal((await call('POST', '/api/facilities/ug-tlt-002/release', { token: tokens.municipality })).data.facility.ownerId, undefined);
});

test('customers-only toilets are listed but never recommended as the nearest public toilet; vanished OSM rows are hidden', async () => {
  await pool.query("UPDATE facilities SET access = 'customers' WHERE id = 'ug-tlt-001'");
  const near = (await call('GET', '/api/facilities/nearest?lat=0.3103&lng=32.5763&category=toilet&usable=1&limit=5')).data.facilities;
  assert.ok(!near.some((f) => f.id === 'ug-tlt-001'));
  const all = (await call('GET', '/api/facilities')).data.facilities;
  assert.equal(all.find((f) => f.id === 'ug-tlt-001').access, 'customers');
  await pool.query("UPDATE facilities SET osm_gone = true WHERE id = 'ug-tlt-002'");
  assert.ok(!(await call('GET', '/api/facilities')).data.facilities.some((f) => f.id === 'ug-tlt-002'));
  await pool.query("UPDATE facilities SET access = 'public' WHERE id = 'ug-tlt-001'");
  await pool.query("UPDATE facilities SET osm_gone = false WHERE id = 'ug-tlt-002'");
});

test('list is lightweight; owner view has detail', async () => {
  const lite = (await call('GET', '/api/facilities')).data.facilities.find((f) => f.id === 'ke-tlt-001');
  assert.equal(lite.daily, undefined);
  assert.equal(lite.usage, undefined);
  const mine = (await call('GET', '/api/facilities/mine', { token: tokens.operator })).data.facilities;
  assert.ok(mine.length > 0 && mine.every((f) => Array.isArray(f.daily) && f.usage !== undefined));
  assert.equal((await call('GET', '/api/facilities/mine', { token: tokens.citizen })).status, 403);
});

test('treatment partners are managed by municipality; none are pre-loaded; destination is optional on jobs', async () => {
  await pool.query('DELETE FROM jobs WHERE destination IS NOT NULL AND false');
  assert.equal((await call('POST', '/api/directory/partners', { token: tokens.provider, body: { name: 'X', product: 'Y' } })).status, 403);
  const p = await call('POST', '/api/directory/partners', { token: tokens.municipality, body: { name: 'Ruiru Biogas', product: 'Biogas' } });
  assert.equal(p.status, 201);
  assert.equal((await call('DELETE', `/api/directory/partners/${p.data.partner.id}`, { token: tokens.municipality })).status, 200);
  assert.equal((await call('DELETE', '/api/directory/partners/t-biogas', { token: tokens.municipality })).status, 409); // has deliveries
  const reports = (await call('GET', '/api/reports', { token: tokens.municipality })).data.reports;
  const target = reports.find((r) => r.facilityId === 'ke-wst-001');
  assert.ok(target);
  const jobs = (await call('GET', '/api/jobs', { token: tokens.municipality })).data.jobs;
  const job = jobs.find((j) => j.reportId === target.id && j.status === 'open');
  await call('POST', `/api/jobs/${job.id}/accept`, { token: tokens.provider });
  const done = await call('POST', `/api/jobs/${job.id}/complete`, { token: tokens.provider, body: { before: PHOTO, after: PHOTO, volumeM3: 3, amountKES: 1000 } });
  assert.equal(done.status, 200);
  assert.equal(done.data.job.destination, undefined);
});

test('public stats are real counts; average rating is null when nothing is rated', async () => {
  const { data } = await call('GET', '/api/stats');
  assert.ok(data.facilities >= 20);
  assert.equal(typeof data.byCategory.toilet, 'number');
  await pool.query('UPDATE facilities SET ratings_count = 0, rating = 0');
  assert.equal((await call('GET', '/api/stats')).data.avg_rating, null);
});

test('import: upsert from OSM-shaped data, never overwrite human state, flag vanished rows', async () => {
  const { importFacilities } = await import('../src/import/facilities.js');
  const region = { key: 'testville', city: 'Nairobi', country: 'Kenya', fallbackArea: 'Greater Nairobi', bbox: [-1.35, 36.75, -1.25, 36.85] };
  const elements = (cat) => ({
    toilet: [
      { type: 'node', id: 9001, lat: -1.3115, lon: 36.7795, tags: { amenity: 'toilets', name: 'Imported Block', fee: 'yes', charge: 'KES 5', wheelchair: 'yes' } },
      { type: 'way', id: 9002, center: { lat: -1.3116, lon: 36.7796 }, tags: { amenity: 'toilets' } },
      { type: 'node', id: 9003, lat: -1.3117, lon: 36.7797, tags: { amenity: 'toilets', access: 'private' } },
      { type: 'node', id: 9004, lat: -1.3118, lon: 36.7798, tags: { amenity: 'toilets', access: 'customers' } },
    ],
  }[cat] ?? []);
  const run = (extra = {}) => importFacilities({ regions: [region], log: () => {}, fetchQuery: async (q) => ({ elements: elements(['toilet', 'water', 'waste', 'health'].find((c) => ({ toilet: 'toilets', water: 'drinking_water', waste: 'waste_disposal', health: 'clinic' })[c] && q.includes(({ toilet: 'toilets', water: 'drinking_water', waste: 'waste_disposal', health: 'clinic' })[c]))) .filter((e) => !extra.drop?.includes(e.id)) }) });
  const first = await run();
  assert.equal(first.counts.testville.toilet, 3); // private one skipped
  let rows = (await pool.query("SELECT id, name, fee, amenities, access, status, area FROM facilities WHERE id LIKE 'osm-%' ORDER BY id")).rows;
  assert.equal(rows.length, 3);
  const block = rows.find((r) => r.id === 'osm-node-9001');
  assert.equal(block.name, 'Imported Block');
  assert.equal(block.fee, 5);
  assert.deepEqual(block.amenities, ['Disability access']);
  assert.match(rows.find((r) => r.id === 'osm-way-9002').name, /^Public toilet, /); // unnamed -> "Public toilet, <ward>"
  assert.match(rows.find((r) => r.id === 'osm-way-9002').area, /Kibera/);
  assert.equal(rows.find((r) => r.id === 'osm-node-9004').access, 'customers');

  // a person acts on it, then the import runs again with changed OSM data
  await call('POST', '/api/facilities/osm-node-9001/rate', { body: { stars: 4 }, headers: { 'X-Device-Id': 'imp' } });
  await call('POST', '/api/reports', { body: { facilityId: 'osm-node-9001', type: 'broken', lat: -1.3115, lng: 36.7795 }, headers: { 'X-Device-Id': 'imp' } });
  await pool.query("UPDATE facilities SET owner_org_id = 'demo-operator', fee = 99 WHERE id = 'osm-way-9002'");
  const second = await run({ drop: [9004] });
  assert.equal(second.counts.testville.toilet, 2);
  rows = (await pool.query("SELECT id, status, rating, ratings_count, fee, osm_gone FROM facilities WHERE id LIKE 'osm-%' ORDER BY id")).rows;
  const kept = rows.find((r) => r.id === 'osm-node-9001');
  assert.equal(kept.status, 'broken'); // human-reported state survives the re-import
  assert.equal(kept.ratings_count, 1);
  assert.equal(rows.find((r) => r.id === 'osm-way-9002').fee, 99); // operator-owned values survive
  assert.equal(rows.find((r) => r.id === 'osm-node-9004').osm_gone, true); // vanished from OSM -> flagged, not deleted
});

test('test fixtures refuse to run against a non-test database', async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://x:y@localhost:5432/sanflow';
  const { seed } = await import('./fixtures.js');
  await assert.rejects(() => seed({ reset: true }), /ends in _test/);
  process.env.DATABASE_URL = saved;
});

test('providers set their own profile; the municipality can read the ward polygons', async () => {
  assert.equal((await call('PATCH', '/api/directory/me', { token: tokens.citizen, body: { zone: 'Nairobi' } })).status, 403);
  assert.equal((await call('PATCH', '/api/directory/me', { token: tokens.provider, body: { zone: 'Mars' } })).status, 400);
  assert.equal((await call('PATCH', '/api/directory/me', { token: tokens.provider, body: { zone: 'Kampala', phone: '+256 700 111 222', providerKind: 'Waste collector' } })).status, 200);
  const providers = (await call('GET', '/api/directory/providers', { token: tokens.provider })).data.providers;
  const mine = providers.find((p) => p.id === 'demo-provider');
  assert.equal(mine.zone, 'Kampala');
  assert.equal(mine.kind, 'Waste collector');
  const g = await call('GET', '/api/analytics/wards.geojson', { token: tokens.municipality });
  assert.equal(g.data.type, 'FeatureCollection');
  assert.ok(g.data.features.length > 0 && g.data.features[0].geometry.type);
  assert.equal((await call('GET', '/api/analytics/wards.geojson', { token: tokens.citizen })).status, 403);
  await call('PATCH', '/api/directory/me', { token: tokens.provider, body: { zone: 'Nairobi', providerKind: 'Sewage exhauster' } });
});
