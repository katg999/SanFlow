# SanFlow Health WASHLink

Phase 1 of the SanFlow Health WASHLink platform — a citizen-facing map for finding
clean toilets, water points, waste disposal sites and health services across
Kenya & Uganda, with community ratings and issue reporting.

Built with **Next.js (App Router)**, **React**, and **Leaflet / OpenStreetMap**
(no API keys required to run it). Deployed on **Netlify**.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:3000`).

Other scripts:

```bash
npm run build      # production build -> .next/
npm run start       # serve the production build locally
npm run lint        # oxlint
```

## What's here (Phase 1)

- **Landing page** (`/`) — marketing/overview page introducing the platform.
- **Find Services** (`/map`) — the core app: an interactive Leaflet map plus a
  searchable, filterable, distance-sorted list of facilities. Click a
  facility to fly to it on the map; rate it with stars; report it as
  filling/full/broken via the alert modal.
- **About** (`/about`) — explains the 3-phase roadmap from the developer brief.

### Data

Facilities are seeded from `src/data/facilities.js` — realistic sample
locations across Nairobi (Kibera, Mukuru, River Road) and Kampala (Kisenyi,
Nakawa, Makindye), plus two rural water points. This stands in for the
PostgreSQL/MongoDB-backed API described in the brief.

User actions (star ratings, status reports) are layered on top of that
baseline and persisted to `localStorage` via `src/hooks/useFacilityStore.js`,
so a rating or report survives a page reload without needing a backend yet.

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

## Deploying to Netlify

This is a standard Next.js app — connect the repo in Netlify and it will
auto-detect Next.js and install `@netlify/plugin-nextjs` for you. `netlify.toml`
sets the build command (`npm run build`) and publish directory (`.next`).
No environment variables are required for Phase 1.

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
