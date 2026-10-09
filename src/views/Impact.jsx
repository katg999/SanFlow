'use client';

import Link from 'next/link';
import { Clock, ShieldCheck, Users, MapPinned, ArrowRight } from 'lucide-react';
import useStats from '../hooks/useStats.js';
import './Impact.css';

const OUTCOMES = [
  {
    icon: Clock,
    title: 'Faster response',
    text: 'A filling toilet or broken borehole is flagged the moment a resident reports it — not weeks later during a routine inspection.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified status',
    text: 'Every "Clean" or "Operational" tag comes from a real visit, not a stale municipal record. Status updates as conditions change.',
  },
  {
    icon: Users,
    title: 'Community-driven',
    text: 'Ratings and reports come from the people who actually use a facility — the same people best placed to know when it fails.',
  },
  {
    icon: MapPinned,
    title: 'Full coverage',
    text: 'Toilets, water points, waste sites and clinics on one map, so a search never misses the closest option because it sits in a different system.',
  },
];

const fmt = (n) => (n == null ? '—' : n.toLocaleString());

export default function Impact() {
  const stats = useStats();

  return (
    <div className="impact">
      <section className="impact-hero">
        <div className="container">
          <span className="eyebrow">Proven impact</span>
          <h1>Numbers that matter on the ground</h1>
          <p>
            SanFlow Health WASHLink exists to shorten the distance between a resident noticing a
            problem and a municipality fixing it. Here&apos;s what that looks like in practice.
          </p>
        </div>
      </section>

      <section className="impact-stats">
        <div className="container">
          <span className="eyebrow eyebrow-inverse">By the numbers</span>
        </div>
        <div className="container impact-stats-grid">
          <div className="impact-stat">
            <span className="impact-stat-value">{fmt(stats?.facilities)}</span>
            <span className="impact-stat-label">Facilities mapped</span>
          </div>
          <div className="impact-stat">
            <span className="impact-stat-value">{fmt(stats?.byCategory?.toilet)}</span>
            <span className="impact-stat-label">Public toilets tracked</span>
          </div>
          <div className="impact-stat">
            <span className="impact-stat-value">{fmt(stats?.byCategory?.water)}</span>
            <span className="impact-stat-label">Water points tracked</span>
          </div>
          <div className="impact-stat">
            <span className="impact-stat-value">{fmt(stats?.reportsVerified)}</span>
            <span className="impact-stat-label">Verified citizen reports</span>
          </div>
          <div className="impact-stat">
            <span className="impact-stat-value">{stats?.avg_rating != null ? `${stats.avg_rating.toFixed(1)}★` : '—'}</span>
            <span className="impact-stat-label">Avg. community rating{stats ? ` (${fmt(stats.rated)} rated)` : ''}</span>
          </div>
        </div>
      </section>

      <section className="impact-outcomes">
        <div className="container">
          <div className="impact-section-heading">
            <span className="eyebrow">What changes on the ground</span>
            <h2>From a report to a fix, without the paper trail</h2>
            <p>
              The value isn&apos;t the map itself — it&apos;s what a live, verified, community-checked
              map lets a municipality do differently.
            </p>
          </div>
          <div className="impact-grid">
            {OUTCOMES.map(({ icon: Icon, title, text }) => (
              <div className="impact-card" key={title}>
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

      <section className="impact-cta">
        <div className="container impact-cta-inner">
          <div>
            <span className="eyebrow eyebrow-inverse">Partner with us</span>
            <h2>Help us reach the next 1,000 facilities</h2>
            <p>
              We&apos;re looking for municipalities, sanitation companies and NGOs to onboard their
              service areas onto SanFlow Health WASHLink.
            </p>
          </div>
          <div className="impact-cta-actions">
            <Link href="/about" className="btn btn-accent">
              See the roadmap <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
