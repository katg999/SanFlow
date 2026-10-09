# SanFlow Health WASHLink

Phase 1 of the SanFlow Health WASHLink platform — a citizen-facing map for finding
clean toilets, water points, waste disposal sites and health services across
Kenya & Uganda, with community ratings and issue reporting.

Built with **Next.js (App Router)**, **React**, and **Leaflet / OpenStreetMap**
(no API keys required to run it). Frontend on Netlify, API on Render (see `docs/BACKEND.md`).

## Getting started

```bash
cp .env.local.example .env.local   # DATABASE_URL + JWT_SECRET
npm install
npm run db:up                      # local PostgreSQL + PostGIS
npm run import                     # real data: wards, population, facilities (once, ~15 min)
npm run dev                        # web app + API on http://localhost:3000
```

The web app and the API are one project and one server (`server.mjs`) — see `docs/BACKEND.md`.



Other scripts:

```bash
npm run build      # production build -> .next/
npm start          # production server (web app + API)
npm test           # API tests (needs the local database)
npm run lint       # oxlint
```

## What's here (Phase 1)

- **Landing page** (`/`) — marketing/overview page introducing the platform.
- **Find Services** (`/map`) — the core app: an interactive Leaflet map plus a
  searchable, filterable, distance-sorted list of facilities. Click a
  facility to fly to it on the map; rate it with stars; report it as
  filling/full/broken via the alert modal.
- **About** (`/about`) — explains the 3-phase roadmap from the developer brief.

## Portals & features (web)

| Route | Who | What |
| --- | --- | --- |
| `/map` | Citizens | Find services; **"Take me to the nearest toilet"** and per-facility Directions draw a real walking route on our own map (OSRM, no API key) with turn-by-turn steps, live GPS tracking, off-route re-routing and arrival → rate / confirm. "Simulate walking" and demo locations (Kampala / Nairobi) work without leaving your desk. Reports take a photo + GPS pin and go through anti-fake verification. |
| `/dashboard/operator` | Facility operators | Register/edit facilities (price, hours, photos, amenities, discounts), fill-level + dirtiness alerts, daily customers/income, complaints, mark cleaned, request an exhauster. |
| `/dashboard/provider` | Exhausters / waste collectors | Job & alert queue, map + route optimisation, before/after-photo completion, printable receipts, public profile, waste-to-value impact. |
| `/dashboard/municipality` | County / municipality | GIS heat map, gap analysis, compliance, citizen-report assignment, analytics, CSV/PDF export, bulk notices. |
| `/dashboard/admin` | Super admin | Users & roles, audit log, deliverables tracker. |
| `/circular-economy` | Everyone | Annex content: toilets as entry points, waste-to-value products, East Africa facts. |

**Real data only.** Facilities, wards and population are imported from OpenStreetMap and WorldPop; everything else is
created by real users. There are no demo accounts or sample data and nothing is stored in the browser — see
`docs/BACKEND.md` for setup (importers, first admin) and limits.

### Data

All facility data comes from the API (PostgreSQL + PostGIS), imported from OpenStreetMap (`server/`, `npm run import`).
Ratings and reports are stored server-side and verified there; the browser stores only the sign-in token.

### Proximity logic

`src/utils/geo.js` implements the brief's "always sort by shortest distance"
rule (haversine distance), used by both the search list and the "Use my
location" button (`navigator.geolocation`).

## Project structure

```
src/
  app/            Next.js App Router routes (layout, providers, shell,
                   page.jsx per route) — thin wrappers around src/views
  components/     Reusable UI: Navbar, Footer, MapView, FacilityCard,
                   RatingStars, StatusBadge, ReportAlertModal, Logo
  views/          Landing, MapPage, About, Login, Register (route content)
  data/           Mock facility data + category/status definitions
  hooks/          useFacilityStore (local state + persistence)
  utils/          geo.js (distance/proximity helpers)
```

## Design

Palette is the SanFlow Health WASHLink mark (navy `#1b3a5c` + teal-green
`#23a382` accent) on a warm off-white ground. Layout language — sticky pill
nav, bold gradient hero, stat strip, full-bleed accent section, numbered
how-it-works, org CTA band, multi-column footer, uppercase Anton display
headings over Inter body text — is adapted from
[researchcoderesolve.org](https://researchcoderesolve.org)'s visual system,
re-themed with SanFlow's own colors. All theme tokens live in `src/index.css`
(`:root` custom properties) if you want to adjust colors, radii or fonts in
one place; fonts are loaded via `next/font/google` in `src/app/layout.jsx`.

## Deploying

Frontend on **Netlify**, API on a free **Render** service, database on free **Neon** (PostGIS). Set
`NEXT_PUBLIC_API_URL` on Netlify to the API URL and `CORS_ORIGIN` on Render to the Netlify URL. `render.yaml` is the Render
blueprint; the step-by-step, including the one-off data import, is in `docs/BACKEND.md`. (`npm start` can also run the
pages and the API together as a single service.)

## Roadmap (from the developer brief)

- [x] **Phase 1** — Core map, search, and user ratings (this build).
- [ ] **Phase 2** — WhatsApp AI Assistant (Twilio / WhatsApp Business API):
      NLP search, "Alert" reporting by reply, Google Maps navigation links.
- [ ] **Phase 3** — Admin dashboard for municipalities/companies: real-time
      alert feed, sanitation coverage heat map, collection-route scheduling,
      and 24-hour SLA escalation to the County Health Officer.

### Suggested next steps when you pick this up

1. Swap the mock data layer (`src/data/facilities.js` +
   `useFacilityStore.js`) for real API calls once a backend exists.
2. Add a geocoding API (per the brief) so users can type an address like
   "Mukuru Slums" instead of only browsing/searching by name.
3. Turn this into a PWA (`next-pwa` or a hand-rolled manifest + service
   worker) per the brief's "works on low-end Android devices" requirement.
4. Build the admin dashboard as a second app or a role-gated route.
5. Wire up the WhatsApp assistant as a separate backend service that reads
   from the same facility data source.

## Continuing in Claude Code

This repo is git-initialized with an initial commit. To keep working on it
with Claude Code from your terminal:

```bash
cd sanflow-washlink
claude
```
