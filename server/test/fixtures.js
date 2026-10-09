// TEST FIXTURES ONLY. This file creates fake users, reports and jobs in a throw-away database so the API
// can be tested. It is never used by the application and refuses to run against anything but a *_test database.
import bcrypt from 'bcryptjs';
import { pool, tx } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { FACILITIES } from './fixtureFacilities.js';

export const FIXTURE_PASSWORD = 'fixture-password-123';

const H = 3600 * 1000;
const D = 24 * H;
const ago = (ms) => new Date(Date.now() - ms);

const WARDS = [
  ['w-kibera', 'Kibera', 'Nairobi', -1.3115, 36.7795, 1600, 5200],
  ['w-mukuru', 'Mukuru', 'Nairobi', -1.3106, 36.8767, 1600, 12000],
  ['w-cbd', 'Nairobi CBD / River Road', 'Nairobi', -1.2822, 36.8267, 1200, 3800],
  ['w-kisenyi', 'Kisenyi', 'Kampala', 0.3115, 32.57, 1200, 6400],
  ['w-nakawa', 'Nakawa', 'Kampala', 0.333, 32.615, 1600, 4100],
  ['w-makindye', 'Makindye', 'Kampala', 0.279, 32.588, 1600, 3000],
]; // population figures are illustrative demo data — replace with census ward data

const PARTNERS = [
  ['t-biogas', 'Kibera Biogas Hub', 'Biogas'],
  ['t-fert', 'Ruiru Organic Fertilizer Co.', 'Organic fertilizer'],
  ['t-brq', 'Kampala Briquette Works', 'Briquettes'],
];

// id, kind, name, provider_kind, zone, licensed, rating, phone, services, fleet
const ORGS = [
  ['demo-operator', 'operator', 'Grace Wanjiru', null, 'Nairobi', true, 0, null, [], 1],
  ['op-kisenyi', 'operator', 'Kisenyi Community Toilets', null, 'Kampala', true, 0, null, [], 1],
  ['demo-provider', 'provider', 'Safi Exhausters Ltd', 'Sewage exhauster', 'Nairobi', true, 4.6, '+254 700 000 111', ['Pit/septic emptying', 'Transport to treatment'], 4],
  ['p-cleanflow', 'provider', 'CleanFlow Waste Collectors', 'Waste collector', 'Nairobi', true, 4.1, '+254 700 000 222', ['Solid waste collection'], 3],
  ['p-sewercare', 'provider', 'Kampala SewerCare', 'Sewage exhauster', 'Kampala', true, 3.8, '+256 700 000 333', ['Pit/septic emptying'], 2],
  ['p-aquafix', 'provider', 'AquaFix Water Repairs', 'Water point repair', 'Nairobi', false, 3.2, '+254 700 000 444', ['Borehole & tap repair'], 2],
];

// name, email, role, org
const USERS = [
  ['Amina Citizen', 'citizen@fixture.test', 'citizen', null],
  ['Grace Wanjiru', 'operator@fixture.test', 'operator', 'demo-operator'],
  ['Safi Exhausters Ltd', 'provider@fixture.test', 'provider', 'demo-provider'],
  ['Nairobi County WASH Office', 'county@fixture.test', 'municipality', null],
  ['SanFlow Super Admin', 'admin@fixture.test', 'admin', null],
  ['Kisenyi Community Toilets', 'kisenyi@example.org', 'operator', 'op-kisenyi'],
  ['Kampala SewerCare', 'ops@sewercare.example', 'provider', 'p-sewercare'],
  ['Wanjiku M.', 'wanjiku@example.com', 'citizen', null],
];

// facility id -> owner org, usage, capacity, last 7 days of customers, fee
const OPERATED = {
  'ke-tlt-001': ['demo-operator', 150, [210, 198, 240, 225, 260, 244, 118], 10],
  'ke-tlt-002': ['demo-operator', 372, [320, 305, 340, 318, 360, 351, 190], 10],
  'ke-tlt-003': ['demo-operator', 410, [90, 85, 70, 40, 0, 0, 0], 5],
  'ug-tlt-001': ['op-kisenyi', 210, [180, 175, 190, 200, 210, 205, 95], 300],
};

// facility, type, note, reporter, age, weight, verified, status, assigned org (or null), resolved age
const REPORTS = [
  ['ke-tlt-002', 'full', 'Septic overflowing near block B.', 'Wanjiku M.', 3 * H, 1, true, 'new'],
  ['ke-tlt-002', 'dirty', 'No water for flushing.', 'Peter O.', 5 * H, 1, true, 'new'],
  ['ke-wtr-002', 'broken', 'Pump handle snapped.', 'Mary A.', 14 * D, 1, true, 'assigned', 'p-aquafix'],
  ['ke-wst-001', 'full', 'Skip overflowing onto road.', 'Hassan K.', 26 * H, 1, true, 'assigned', 'demo-provider'],
  ['ke-tlt-003', 'broken', 'Door lock and one cubicle broken.', 'Faith N.', 3 * D, 1, true, 'new'],
  ['ug-wst-001', 'full', 'Disposal point full for two days.', 'Ronald S.', 2 * D, 1, true, 'new'],
  ['ug-wtr-003', 'broken', 'Borehole dry, community fetching from stream.', 'Esther B.', 9 * D, 1, true, 'new'],
  [null, 'dumping', 'Illegal dumping behind the market.', 'Anonymous', 8 * H, 1, true, 'new', null, null, [-1.2835, 36.829]],
  ['ke-tlt-001', 'dirty', 'Floors dirty by midday.', 'John D.', 4 * D, 1, true, 'resolved', 'demo-operator', 4 * D - 5 * H],
  ['ug-tlt-002', 'dirty', 'Needs cleaning.', 'Joan T.', 1 * D, 0.4, false, 'new'],
];

// facility, report index (or null), type, priority, zone, status, provider, created, completed, m3, amount, destination, receipt
const JOBS = [
  ['ke-tlt-002', 0, 'pit', 'high', 'Nairobi', 'open', 'demo-provider', 3 * H],
  ['ke-wst-001', 3, 'waste', 'medium', 'Nairobi', 'open', 'demo-provider', 26 * H],
  ['ke-tlt-003', 4, 'pit', 'high', 'Nairobi', 'open', 'demo-provider', 2 * D],
  ['ke-wtr-002', 2, 'water', 'high', 'Nairobi', 'open', 'p-aquafix', 14 * D],
  ['ke-tlt-004', null, 'pit', 'low', 'Nairobi', 'open', 'demo-provider', 5 * H],
  ['ke-tlt-001', null, 'pit', 'medium', 'Nairobi', 'done', 'demo-provider', 6 * D, 5 * D, 6, 9000, 't-biogas', 'RCP-1001'],
  ['ke-tlt-002', null, 'pit', 'medium', 'Nairobi', 'done', 'demo-provider', 10 * D, 9 * D, 8, 11500, 't-fert', 'RCP-1002'],
  ['ke-wst-002', null, 'waste', 'low', 'Nairobi', 'done', 'p-cleanflow', 12 * D, 11 * D, 12, 7000, 't-biogas', 'RCP-1003'],
  ['ug-tlt-001', null, 'pit', 'medium', 'Kampala', 'done', 'p-sewercare', 8 * D, 7 * D, 7, 0, 't-brq', 'RCP-1004'],
];

const pt = (lat, lng) => [lng, lat];

export async function seed({ reset = false } = {}) {
  if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('Refusing to load test fixtures: DATABASE_URL must point at a database whose name ends in _test');
  }
  await migrate();
  const password = FIXTURE_PASSWORD;
  const hash = await bcrypt.hash(password, 10);

  await tx(async (c) => {
    if (reset) {
      await c.query('TRUNCATE audit_log, notices, jobs, confirmations, reports, ratings, facility_daily, facility_state, facilities, wards, treatment_partners, users, organisations RESTART IDENTITY CASCADE');
      await c.query('ALTER SEQUENCE receipt_seq RESTART WITH 1005');
    } else {
      await c.query('ALTER SEQUENCE receipt_seq RESTART WITH 1005');
    }

    for (const w of WARDS) {
      await c.query('INSERT INTO wards(id, name, city, center, radius_m, population, boundary) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6::int, $7, ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, ($6::int)::float8)::geometry)::geography) ON CONFLICT (id) DO NOTHING', w);
    }
    for (const p of PARTNERS) await c.query('INSERT INTO treatment_partners(id, name, product) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', p);
    for (const o of ORGS) {
      await c.query('INSERT INTO organisations(id, kind, name, provider_kind, zone, licensed, rating, phone, services, fleet) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING', o);
    }
    const userIds = {};
    for (const [name, email, role, org] of USERS) {
      const { rows } = await c.query('INSERT INTO users(name, email, password_hash, role, org_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name, email, hash, role, org]);
      userIds[email] = rows[0].id;
    }

    for (const f of FACILITIES) {
      const op = OPERATED[f.id];
      const status = f.id === 'ke-wtr-003' ? 'seasonal' : f.status;
      const [lng, lat] = pt(f.lat, f.lng);
      await c.query(
        `INSERT INTO facilities(id, category, name, area, country, geom, image, description, hours, status, rating, ratings_count, fee, owner_org_id, licensed, discount_pct, discount_label)
         VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`,
        [f.id, f.category, f.name, f.area, f.country, lng, lat, f.image ?? null, f.description ?? null, f.hours ?? null, status, f.rating ?? 0, f.ratingsCount ?? 0,
         op?.[3] ?? null, op?.[0] ?? null, f.id === 'ke-tlt-004' ? false : null, f.id === 'ke-tlt-001' ? 20 : null, f.id === 'ke-tlt-001' ? 'Students 20% off before 9 AM' : null]
      );
      const brokenSince = { 'ke-tlt-003': 3 * D, 'ke-wtr-002': 14 * D, 'ug-wtr-003': 9 * D }[f.id];
      await c.query('INSERT INTO facility_state(facility_id, usage_count, broken_since) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [f.id, op?.[1] ?? 0, brokenSince ? ago(brokenSince) : null]);
      if (op) {
        for (let i = 0; i < 7; i += 1) {
          await c.query('INSERT INTO facility_daily(facility_id, day, customers) VALUES ($1, current_date - $2::int, $3) ON CONFLICT DO NOTHING', [f.id, 6 - i, op[2][i]]);
        }
      }
    }

    const names = Object.fromEntries(ORGS.map((o) => [o[0], o[2]]));
    const reportIds = [];
    for (const [i, r] of REPORTS.entries()) {
      const [fac, type, note, who, age, weight, verified, status, assigned, resolvedAge, gps] = r;
      const kind = assigned ? (ORGS.find((o) => o[0] === assigned)[1]) : null;
      const geom = gps ? 'ST_SetSRID(ST_MakePoint($12, $13), 4326)::geography' : 'NULL';
      const params = [fac, type, note, who, ago(age), weight, verified, status, kind, assigned, assigned ? names[assigned] : null];
      if (gps) params.push(gps[1], gps[0]);
      const { rows } = await c.query(
        `INSERT INTO reports(facility_id, type, note, reporter_name, created_at, weight, verified, status, assigned_kind, assigned_id, assigned_name, reporter_key, geom, resolved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'seed:${i}',${geom},${resolvedAge ? `now() - interval '${Math.round(resolvedAge / H)} hours'` : 'NULL'}) RETURNING id`, params);
      reportIds.push(rows[0].id);
    }
    for (const j of JOBS) {
      const [fac, ri, type, priority, zone, status, provider, created, completed, m3, amount, dest, receipt] = j;
      const f = FACILITIES.find((x) => x.id === fac);
      await c.query(
        `INSERT INTO jobs(type, facility_id, report_id, geom, priority, zone, status, provider_id, created_at, completed_at, volume_m3, amount_kes, destination, receipt_no)
         VALUES ($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [type, fac, ri == null ? null : reportIds[ri], f.lng, f.lat, priority, zone, status, provider, ago(created), completed ? ago(completed) : null, m3 ?? null, amount ?? null, dest ?? null, receipt ?? null]);
    }

    await c.query("INSERT INTO notices(title, body, area, channels, recipients, sent_by, created_at) VALUES ('Water chlorination — Mukuru', 'Water chlorination in Mukuru will take place tomorrow 8 AM – 12 PM. Please store drinking water in advance.', 'Mukuru', 'SMS + App', 12000, 'Nairobi County WASH Office', $1)", [ago(2 * H)]);
    await c.query("INSERT INTO audit_log(actor_name, action, target, at) VALUES ('system', 'Platform seeded', '—', $1), ('Nairobi County WASH Office', 'Sent bulk notice', 'Mukuru (SMS + App)', $2)", [ago(30 * D), ago(2 * H)]);
  });

}
