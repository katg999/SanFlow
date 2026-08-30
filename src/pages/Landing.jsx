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
import { useLanguage } from '../i18n/LanguageContext.jsx';
import toiletPhoto1 from '../assets/facilities/toilet-1.jpg';
import toiletPhoto2 from '../assets/facilities/toilet-2.jpg';
import toiletPhoto3 from '../assets/facilities/toilet-3.jpg';
import wastePhoto1 from '../assets/facilities/waste-1.jpg';
import './Landing.css';

const GALLERY = [
  { src: toiletPhoto1, tag: 'Public toilet', caption: 'Newly built toilet block, ready for community use.' },
  { src: toiletPhoto2, tag: 'Public toilet', caption: 'Toilet block with separate stalls and roofed access path.' },
  { src: wastePhoto1, tag: 'Waste point', caption: 'Uncollected waste point flagged for pickup.' },
  { src: toiletPhoto3, tag: 'Public toilet', caption: 'Toilet block with signage for accessible access.' },
];

const FEATURE_ICONS = [MapPinned, Star, Bell, MessageCircle];
const STEP_NUMBERS = ['01', '02', '03', '04'];

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
  const { t } = useLanguage();
  useReveal();

  const FEATURES = [1, 2, 3, 4].map((i) => ({
    icon: FEATURE_ICONS[i - 1],
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
        <div className="container hero-panel">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow eyebrow-inverse">
                <Droplets size={14} /> {t('landing.eyebrow')}
              </span>
              <h1>
                {t('landing.heroHeading')}
                <span className="hero-highlight"> {t('landing.heroHighlight')}</span>
              </h1>
              <p className="hero-lead">{t('landing.heroLead')}</p>
              <div className="hero-actions">
                <Link to="/map" className="btn btn-primary">
                  <Search size={17} /> {t('landing.findService')}
                </Link>
                <a
                  href="https://wa.me/255744090361"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  <MessageCircle size={17} /> {t('landing.chatWhatsapp')}
                </a>
              </div>
              <div className="hero-trust">
                <ShieldCheck size={16} />
                {t('landing.heroTrust')}
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-card hero-card-main">
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-toilet" />
                  <div>
                    <strong>Kisenyi Public Toilet Block</strong>
                    <p>240m away · {t('status.clean')}</p>
                  </div>
                  <span className="hero-rating">★ 4.0</span>
                </div>
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-water" />
                  <div>
                    <strong>Makindye Borehole</strong>
                    <p>410m away · {t('status.operational')}</p>
                  </div>
                  <span className="hero-rating">★ 4.3</span>
                </div>
                <div className="hero-card-row">
                  <span className="hero-pin hero-pin-health" />
                  <div>
                    <strong>Kisenyi Health Centre III</strong>
                    <p>650m away · {t('status.open')}</p>
                  </div>
                  <span className="hero-rating">★ 4.2</span>
                </div>
              </div>
              <div className="hero-card hero-card-alert">
                <Bell size={16} />
                <div>
                  <strong>Alert sent</strong>
                  <p>Nakawa Market Toilet · {t('status.filling')}</p>
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
            <span className="stat-label">{t('landing.statFacilities')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">200+</span>
            <span className="stat-label">{t('landing.statToilets')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">200+</span>
            <span className="stat-label">{t('landing.statWater')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.countries}</span>
            <span className="stat-label">{t('landing.statCountries')}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.avgRating.toFixed(1)}★</span>
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
            <a href="#admin" className="btn btn-accent">
              {t('landing.orgCta')} <ArrowRight size={16} />
            </a>
            <span className="org-cta-note">{t('landing.orgNote')}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
