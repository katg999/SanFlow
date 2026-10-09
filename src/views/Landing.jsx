'use client';

import Link from 'next/link';
import {
  Droplets,
  MapPinned,
  Star,
  Bell,
  MessageCircle,
  Search,
  Building2,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react';
import useReveal from '../hooks/useReveal.js';
import useStats from '../hooks/useStats.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Landing.css';

const fmt = (n) => (n == null ? '—' : n.toLocaleString());

const GALLERY = [
  { src: '/facilities/toilet-1.jpg', tag: 'Public toilet', caption: 'Newly built toilet block, ready for community use.' },
  { src: '/facilities/toilet-2.jpg', tag: 'Public toilet', caption: 'Toilet block with separate stalls and roofed access path.' },
  { src: '/facilities/waste-1.jpg', tag: 'Waste point', caption: 'Uncollected waste point flagged for pickup.' },
  { src: '/facilities/toilet-3.jpg', tag: 'Public toilet', caption: 'Toilet block with signage for accessible access.' },
];

const FEATURE_ICONS = [MapPinned, Star, Bell, MessageCircle];
const FEATURE_LINKS = [
  { href: '/map', external: false },
  { href: '/map', external: false },
  { href: '/map?report=1', external: false },
  { href: 'https://wa.me/256772207616', external: true },
];
const STEP_NUMBERS = ['01', '02', '03', '04'];

export default function Landing() {
  const stats = useStats();
  const { t } = useLanguage();
  useReveal();

  const FEATURES = [1, 2, 3, 4].map((i) => ({
    icon: FEATURE_ICONS[i - 1],
    href: FEATURE_LINKS[i - 1].href,
    external: FEATURE_LINKS[i - 1].external,
    title: t(`landing.feature${i}Title`),
    text: t(`landing.feature${i}Text`),
  }));

  const STEPS = [1, 2, 3, 4].map((i) => ({
    step: STEP_NUMBERS[i - 1],
    title: t(`landing.step${i}Title`),
    text: t(`landing.step${i}Text`),
  }));

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <span className="hero-location">
            <Droplets size={13} /> {t('landing.eyebrow')}
          </span>
          <h1>
            {t('landing.heroHeading')}
            <br />
            <span className="hero-highlight">{t('landing.heroHighlight')}</span>
          </h1>
          <div className="hero-actions">
            <Link href="/map" className="btn btn-primary">
              <Search size={17} /> {t('landing.findService')}
            </Link>
            <a
              href="https://wa.me/256772207616"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
            >
              <MessageCircle size={16} /> {t('landing.chatWhatsapp')}
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats reveal">
        <div className="container">
          <span className="eyebrow eyebrow-inverse stats-eyebrow">{t('landing.statsEyebrow')}</span>
        </div>
        <div className="container stats-grid">
          <div className="stat-tile">
            <span className="stat-value">{fmt(stats?.facilities)}</span>
            <span className="stat-label">{t('landing.statFacilities')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{fmt(stats?.byCategory?.toilet)}</span>
            <span className="stat-label">{t('landing.statToilets')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{fmt(stats?.byCategory?.water)}</span>
            <span className="stat-label">{t('landing.statWater')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{fmt(stats?.countries)}</span>
            <span className="stat-label">{t('landing.statCountries')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats?.avg_rating != null ? `${stats.avg_rating.toFixed(1)}★` : '—'}</span>
            <span className="stat-label">{t('landing.statRating')}</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <div className="section-heading reveal">
            <span className="eyebrow">{t('landing.featuresEyebrow')}</span>
            <h2>{t('landing.featuresHeading')}</h2>
            <p>{t('landing.featuresLead')}</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text, href, external }, i) => {
              const cardProps = {
                className: 'feature-card reveal',
                style: { transitionDelay: `${i * 80}ms` },
              };
              const content = (
                <>
                  <span className="feature-card-arrow">
                    <ArrowUpRight size={15} />
                  </span>
                  <div className="icon-badge">
                    <Icon size={20} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </>
              );

              return external ? (
                <a key={title} href={href} target="_blank" rel="noreferrer" {...cardProps}>
                  {content}
                </a>
              ) : (
                <Link key={title} href={href} {...cardProps}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="gallery">
        <div className="container">
          <div className="section-heading reveal">
            <span className="eyebrow">{t('landing.galleryEyebrow')}</span>
            <h2>{t('landing.galleryHeading')}</h2>
            <p>{t('landing.galleryLead')}</p>
          </div>
          <div className="gallery-grid">
            {GALLERY.map(({ src, tag, caption }, i) => (
              <figure
                className="gallery-item reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
                key={src}
              >
                <img src={src} alt={caption} loading="lazy" />
                <figcaption>
                  <span className="gallery-tag">{tag}</span>
                  {caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <div className="container">
          <div className="section-heading reveal">
            <span className="eyebrow">{t('landing.howEyebrow')}</span>
            <h2>{t('landing.howHeading')}</h2>
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

      {/* Annex: tagline + one platform, four sides */}
      <section className="landing-portals">
        <div className="container">
          <p className="landing-tagline">Find. Access. Report. Respond. Transform.</p>
          <div className="landing-portal-grid">
            {[
              ['/map', 'Citizens', 'Find the nearest clean toilet and be guided there — without leaving the site.'],
              ['/login', 'Facility operators', 'List your facility, set prices, get fill-level alerts and see your income.'],
              ['/login', 'Service providers', 'Receive exhauster and repair jobs, optimise routes, issue digital receipts.'],
              ['/login', 'Municipalities', 'A live control tower: GIS, gap analysis, compliance, reports and bulk notices.'],
            ].map(([href, title, text]) => (
              <Link key={title} href={href} className="landing-portal-card">
                <h3>{title}</h3>
                <p>{text}</p>
                <span>Open <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
          <p className="landing-circ">
            Waste is a resource. <Link href="/circular-economy">See how collected waste becomes fertilizer, biogas and carbon credits <ArrowRight size={14} /></Link>
          </p>
        </div>
      </section>

      {/* CTA for organizations */}
      <section className="org-cta">
        <div className="container org-cta-inner reveal">
          <div>
            <span className="eyebrow eyebrow-inverse">
              <Building2 size={14} /> {t('landing.orgEyebrow')}
            </span>
            <h2>{t('landing.orgHeading')}</h2>
            <p>{t('landing.orgText')}</p>
          </div>
          <div className="org-cta-actions">
            <Link href="/login" className="btn btn-accent">
              {t('landing.orgCta')} <ArrowRight size={16} />
            </Link>
            <span className="org-cta-note">{t('landing.orgNote')}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
