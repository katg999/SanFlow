# Backend (PostgreSQL + PostGIS) — real data only

The API in `server/` (Express + `pg`, PostgreSQL 16 + PostGIS) is the only source of data. The web app keeps nothing
in the browser: if the server is unreachable it shows an error, never sample data. There are no demo accounts, no
seeded facilities, reports or jobs, and no demo login endpoint.

## Where the data comes from
| Data | Source | How |
| --- | --- | --- |
| Toilets, water points, waste points, clinics/pharmacies (Nairobi + Kampala metro) | OpenStreetMap (ODbL) via Overpass | `npm run import:facilities` |
| Ward / division boundaries | OpenStreetMap admin boundaries (level 8) | `npm run import:wards` |
| Ward population | WorldPop 2020 (CC BY 4.0), modelled estimates summed over each ward polygon | `npm run import:population` |
| Ratings, reports, confirmations, jobs, receipts, notices, users, operators, providers, treatment partners, licence status | People using the platform | the app itself |

Nothing else is invented: fee, hours, amenities come from OSM tags only when stated; queue, last-cleaned and water quality
stay empty until an operator, citizen or sensor records them. Most facilities therefore show **"Not yet verified"**
and every dashboard starts empty — that is correct for real data.

### Import results (October 2026)
11,940 facilities: 2,674 toilets, 4,090 water points, 2,272 waste points, 2,904 health facilities (916 `access=private`
items skipped; customers-only toilets are listed but never recommended as a public toilet).
Wards: 66 Nairobi wards (of the 85 official; the rest are not mapped as polygons in OSM — about 73 % of the county area)
and 5 Kampala divisions (full coverage). Population check against 2019 census totals: Kampala 1.71 M vs 1.68 M;
Nairobi 3.66 M vs 4.40 M (consistent with the missing wards). Gap analysis is only as complete as OSM mapping —
a low toilet count can mean "not yet mapped".

## Run it — one project, one server, one URL
The web app (Next.js) and the API (Express, `/api/*`) are a single package and run in a single Node process (`server.mjs`)
on one port. There is no separate API deployment and no CORS.
```bash
cp .env.local.example .env.local   # set DATABASE_URL and a 32+ char JWT_SECRET (one file for everything)
npm install
npm run db:up                      # local PostgreSQL + PostGIS (docker compose), port 54329
npm run import                     # wards -> population -> facilities (order matters; ~15 min, Overpass mirrors can be slow)
ADMIN_PASSWORD='<12+ chars>' npm run create-admin -- you@example.org "Your Name"   # first super-admin
npm run dev                        # http://localhost:3000  (production: npm run build && npm start)
```
Layout: `src/` web app · `server/src/` API, importers · `server/migrations/` schema (applied on every start) ·
`server/test/` tests (`npm test`).

Everyone else registers in the app (citizen / operator / provider). The admin promotes people to municipality or
admin in the Admin portal. Municipality staff add treatment partners and verify provider/operator licences.
Re-running `npm run import:facilities` is safe: it refreshes tag-derived fields only, never overwrites status, ratings,
ownership or operator-edited values, and flags (does not delete) rows that disappeared from OSM. Schedule it weekly.

## Enforced on the server
Roles from the DB on every request; self-signup limited to citizen/operator/provider; report verification (1 report per
person per facility/type/day, GPS-distance weighting, ≥ 1.0 weighted confirmations to change status); two people must
confirm a "working" answer before a broken point flips back; one rating per person; scoped reads (operators their own
facilities, providers their work, citizens their reports); transactional job completion with before/after photos and a
sequence-numbered receipt; audit log on every mutation; rate limits, helmet, gzip, body/photo size caps. Nobody can create
`osm-*` facilities by calling the API — they exist only through the importer.

## Tests
`npm test` (39 tests) runs against a throw-away `sanflow_test` database using fixtures in `server/test/` (fake users and
data, test-only; the loader refuses to run unless `DATABASE_URL` ends in `_test`). Includes unit tests for the OSM tag
mapping and an integration test of the importer's upsert/never-overwrite rules.

## Known limits / next steps
- Photos are base64 text (~300 KB cap after client shrinking), served on demand. Move to object storage before real traffic.
- Rate limiting is in-memory per process; use Redis/edge when running several instances.
- Bulk SMS is recorded but not sent (Africa's Talking not connected). USSD, M-Pesa/MoMo, FCM push, IoT not built.
- No climate (CO2e) figure is shown: it needs a verified methodology. Only measured volume delivered to registered
  treatment partners is reported.
- Add real polygons for the 19 unmapped Nairobi wards (or load official IEBC/KNBS boundaries) and official census ward
  populations when available; `wards.population_source` records where each number came from.
- No browser/E2E test suite yet.

## Attribution (licence requirement)
"Facility and boundary data © OpenStreetMap contributors (ODbL) · Population estimates © WorldPop (CC BY 4.0)" appears on the map,
footer, municipality dashboard and in every CSV export.

## Deploying (free): frontend on Netlify, API on Render, database on Neon
The project can run as one server (`npm start`: pages + API), but with the frontend already on Netlify the API runs on its
own with `API_ONLY=true`. `render.yaml` is a Render blueprint for that.

1. **Database** — create a free Neon (or Supabase) Postgres; run `CREATE EXTENSION postgis;`; copy the connection string.
2. **Load the data once, from your machine** (it needs the Overpass/WorldPop sites, ~15 min):
   `DATABASE_URL='<neon url>' DATABASE_SSL=true npm run import`, then
   `DATABASE_URL='<neon url>' DATABASE_SSL=true ADMIN_PASSWORD='<12+ chars>' npm run create-admin -- you@example.org "Your Name"`.
3. **API on Render** — New → Blueprint → this repo. Set `DATABASE_URL` (Neon string) and `CORS_ORIGIN` (your Netlify URL,
   e.g. `https://sanflow.netlify.app`); `JWT_SECRET` is generated. Note the service URL (e.g. `https://sanflow-api.onrender.com`).
   Check `<url>/api/health` returns `{"ok":true,"db":true}`.
4. **Frontend on Netlify** — Site settings → Environment variables: `NEXT_PUBLIC_API_URL` = the Render URL (no trailing
   slash), then redeploy (it is baked in at build time).

Free web services sleep when idle: the first visit after a quiet spell can take up to a minute (the app waits and
retries for ~65 s). Free databases have size/inactivity limits. Check the providers' current terms and move to an
always-on plan for real traffic. To run everything as a single service instead, drop `API_ONLY`/`CORS_ORIGIN` and leave
`NEXT_PUBLIC_API_URL` unset — pages and API then share one URL.
