import { Link } from 'react-router-dom';
import {
  Droplets,
  MapPinned,
  Star,
  Bell,
  MessageCircle,
  Search,
  ShieldCheck,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { FACILITIES, CATEGORIES } from '../data/facilities.js';
import useReveal from '../hooks/useReveal.js';
import './Landing.css';

const FEATURES = [
  {
    icon: MapPinned,
    title: 'One live map',
    text: 'Public toilets, waste pits, water points and clinics — plotted together so you never have to guess where to go.',
  },
  {
    icon: Star,
    title: 'Community ratings',
    text: 'Every facility carries a star rating from real users, so you know what "clean" and "safe" actually mean before you arrive.',
  },
  {
    icon: Bell,
    title: 'Real-time alerts',
    text: 'Report a toilet filling up or a borehole breaking down in two taps. Municipalities see it the moment you send it.',
  },
  {
    icon: MessageCircle,
    title: 'Works over WhatsApp',
    text: 'No smartphone or data bundle? Message our WhatsApp assistant to search, get directions and report issues. (Phase 2)',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Search or browse the map',
    text: 'Ask for the nearest clean toilet, water source or clinic — results are always sorted by distance from you.',
  },
  {
    step: '02',
    title: 'Check status & ratings',
    text: 'See live status — clean, filling, full or broken — plus community star ratings before you make the trip.',
  },
  {
    step: '03',
    title: 'Report what you see',
    text: 'Flag a filling toilet or a broken borehole. Your report goes straight into the facility record.',
  },
  {
    step: '04',
    title: 'Municipalities respond',
    text: 'Issues open longer than 24 hours auto-escalate to the County Health Officer for action.',
  },
];

function useStats() {
  const total = FACILITIES.length;
  const byCategory = Object.keys(CATEGORIES).reduce((acc, key) => {
    acc[key] = FACILITIES.filter((f) => f.category === key).length;
    return acc;
  }, {});
  const countries = new Set(FACILITIES.map((f) => f.country)).size;
  const avgRating =
    FACILITIES.reduce((sum, f) => sum + f.rating, 0) / FACILITIES.length;

  return { total, byCategory, countries, avgRating };
}

export default function Landing() {
  const stats = useStats();
  useReveal();

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="container hero-panel">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow eyebrow-inverse">
                <Droplets size={14} /> WASH access platform · Kenya &amp; Uganda
              </span>
              <h1>
                Clean water, safe toilets, and health services —
                <span className="hero-highlight"> mapped near you.</span>
              </h1>
              <p className="hero-lead">
                SanFlow Health WASHLink connects citizens, municipalities and sanitation
                companies on one platform — so a filling toilet or a broken borehole gets
                fixed before it becomes a health crisis.
              </p>
              <div className="hero-actions">
                <Link to="/map" className="btn btn-primary">
                  <Search size={17} /> Find a service near me
                </Link>
                <a
                  href="https://wa.me/254700000000"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  <MessageCircle size={17} /> Chat on WhatsApp
                </a>
              </div>
              <div className="hero-trust">
                <ShieldCheck size={16} />
                Baseline data verified with local municipalities · Crowdsourced &amp; moderated
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-card hero-card-main">
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-toilet" />
                  <div>
                    <strong>Kibera DC Public Toilet</strong>
                    <p>240m away · Clean</p>
                  </div>
                  <span className="hero-rating">★ 4.2</span>
                </div>
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-water" />
                  <div>
                    <strong>Line Saba Communal Tap</strong>
                    <p>410m away · Operational</p>
                  </div>
                  <span className="hero-rating">★ 4.4</span>
                </div>
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-health" />
                  <div>
                    <strong>Kibera South Health Centre</strong>
                    <p>650m away · Open now</p>
                  </div>
                  <span className="hero-rating">★ 4.1</span>
                </div>
              </div>
              <div className="hero-card hero-card-alert">
                <Bell size={16} />
                <div>
                  <strong>Alert sent</strong>
                  <p>Toi Market Toilet · Filling up</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats reveal">
        <div className="container stats-grid">
          <div className="stat-tile">
            <span className="stat-value">{stats.total}+</span>
            <span className="stat-label">Facilities mapped</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.byCategory.toilet ?? 0}</span>
            <span className="stat-label">Toilets tracked</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.byCategory.water ?? 0}</span>
            <span className="stat-label">Water points</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.countries}</span>
            <span className="stat-label">Countries live</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.avgRating.toFixed(1)}★</span>
            <span className="stat-label">Avg. community rating</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <div className="section-heading reveal">
            <span className="eyebrow">Why SanFlow Health WASHLink</span>
            <h2>Built for how people actually find WASH services</h2>
            <p>
              One system for urban sanitation, rural water access and healthcare mapping —
              accessible whether you have a smartphone, a feature phone, or neither.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <div
                className="feature-card reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
                key={title}
              >
                <div className="icon-badge">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <div className="container">
          <div className="section-heading reveal">
            <span className="eyebrow">How it works</span>
            <h2>From a filling toilet to a fixed one — in four steps</h2>
          </div>
          <div className="steps-grid">
            {STEPS.map(({ step, title, text }, i) => (
              <div
                className="step-card reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
                key={step}
              >
                <span className="step-number">{step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for organizations */}
      <section className="org-cta">
        <div className="container org-cta-inner reveal">
          <div>
            <span className="eyebrow eyebrow-inverse">
              <Building2 size={14} /> For municipalities &amp; sanitation companies
            </span>
            <h2>Turn citizen reports into a proactive collection schedule</h2>
            <p>
              The admin dashboard gives county officials and sewage companies a live view of
              filling toilets, broken boreholes and sanitation coverage gaps — with automatic
              escalation when an issue sits open for more than 24 hours.
            </p>
          </div>
          <div className="org-cta-actions">
            <a href="#admin" className="btn btn-accent">
              Request dashboard access <ArrowRight size={16} />
            </a>
            <span className="org-cta-note">Admin dashboard ships in Phase 3</span>
          </div>
        </div>
      </section>
    </div>
  );
}
