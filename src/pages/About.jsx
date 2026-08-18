import { MapPinned, MessageCircle, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import './About.css';

const PHASES = [
  {
    icon: MapPinned,
    title: 'Phase 1 — Core Map & Ratings',
    status: 'Live now',
    live: true,
    text: 'Interactive map of toilets, waste points, water sources and clinics across Kenya & Uganda, with search, filtering, star ratings and citizen alert reporting.',
  },
  {
    icon: MessageCircle,
    title: 'Phase 2 — WhatsApp AI Assistant',
    status: 'Planned',
    live: false,
    text: 'Natural-language search ("Find borehole in Kibera"), the 5 nearest facilities with distance & ratings, "Alert" reporting, and Google Maps navigation links — all inside WhatsApp via the Business API.',
  },
  {
    icon: LayoutDashboard,
    title: 'Phase 3 — Admin Dashboard & Escalation',
    status: 'Planned',
    live: false,
    text: 'A municipal dashboard with real-time alerts, sanitation coverage heat maps, collection-route scheduling, and automatic escalation to the County Health Officer when a "Full" status stays open past 24 hours.',
  },
];

export default function About() {
  return (
    <div className="about">
      <section className="about-hero">
        <div className="container">
          <span className="eyebrow">About the platform</span>
          <h1>One WASH ecosystem for East Africa</h1>
          <p>
            SanFlow &amp; WASHLink combines SanFlow (smart waste management) and WASHLink
            (resource mapping) into a single digital infrastructure — shifting municipalities
            from reactive management to proactive, data-driven WASH service delivery.
          </p>
        </div>
      </section>

      <section className="about-phases">
        <div className="container">
          <div className="about-phase-list">
            {PHASES.map(({ icon: Icon, title, status, live, text }) => (
              <div className={`about-phase ${live ? 'is-live' : ''}`} key={title}>
                <div className="icon-badge about-phase-icon">
                  <Icon size={20} />
                </div>
                <div className="about-phase-body">
                  <div className="about-phase-top">
                    <h3>{title}</h3>
                    <span className={`about-phase-status ${live ? 'is-live' : ''}`}>
                      {live && <CheckCircle2 size={13} />}
                      {status}
                    </span>
                  </div>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-stack">
        <div className="container">
          <span className="eyebrow">Under the hood</span>
          <h2>Built to run on low-end Android devices</h2>
          <div className="about-stack-grid">
            <div>
              <h4>Frontend</h4>
              <p>React + Vite responsive web app (PWA-ready), Leaflet + OpenStreetMap for mapping.</p>
            </div>
            <div>
              <h4>Data &amp; API</h4>
              <p>PostgreSQL / MongoDB for facility, user and rating data; geocoding API for address search.</p>
            </div>
            <div>
              <h4>Rules engine</h4>
              <p>Proximity-first sorting on every search, plus a 24-hour SLA that auto-escalates unresolved reports.</p>
            </div>
            <div>
              <h4>Access channels</h4>
              <p>Responsive web app today; WhatsApp Business API / Twilio assistant in Phase 2 for feature-phone access.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
