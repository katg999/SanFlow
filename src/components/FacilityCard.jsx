'use client';

import { Droplet, Trash2, HeartPulse, Bath, Clock, TriangleAlert, Footprints, Car } from 'lucide-react';
import { CATEGORIES } from '../data/facilities.js';
import { formatDistance, estimateEta } from '../utils/geo.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import RatingStars from './RatingStars.jsx';
import './FacilityCard.css';

const ICONS = {
  toilet: Bath,
  waste: Trash2,
  water: Droplet,
  health: HeartPulse,
};

export default function FacilityCard({
  facility,
  distanceKm,
  showEta = false,
  active = false,
  onSelect,
  onReport,
}) {
  const { t } = useLanguage();
  const Icon = ICONS[facility.category] ?? Droplet;
  const category = CATEGORIES[facility.category];
  const eta = showEta ? estimateEta(distanceKm) : null;

  return (
    <article
      className={`facility-card ${active ? 'is-active' : ''}`}
      onClick={() => onSelect?.(facility)}
    >
      {facility.image ? (
        <img className="facility-photo" src={facility.image} alt="" loading="lazy" />
      ) : (
        <div className="facility-icon" style={{ background: `${category.color}1a`, color: category.color }}>
          <Icon size={18} />
        </div>
      )}

      <div className="facility-body">
        <div className="facility-top">
          <h4>{facility.name}</h4>
          {Number.isFinite(distanceKm) && (
            <span className="facility-distance">{formatDistance(distanceKm)}</span>
          )}
        </div>
        <p className="facility-area">{facility.area}</p>

        <div className="facility-meta">
          <StatusBadge status={facility.status} size="sm" />
          <RatingStars value={facility.rating} count={facility.ratingsCount} size={13} />
        </div>

        {eta && (
          <p className="facility-eta">
            <Footprints size={12} /> {t('map.walk', { min: eta.walkMin })}
            <span className="facility-eta-sep">·</span>
            <Car size={12} /> {t('map.drive', { min: eta.driveMin })}
          </p>
        )}

        {facility.hours && (
          <p className="facility-hours">
            <Clock size={12} /> {facility.hours}
          </p>
        )}

        <button
          type="button"
          className="facility-report-btn"
          onClick={(e) => {
            e.stopPropagation();
            onReport?.(facility);
          }}
        >
          <TriangleAlert size={13} /> {t('map.reportIssue')}
        </button>
      </div>
    </article>
  );
}