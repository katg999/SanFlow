import { Droplet, Trash2, HeartPulse, Bath, Clock, TriangleAlert } from 'lucide-react';
import { CATEGORIES } from '../data/facilities.js';
import { formatDistance } from '../utils/geo.js';
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
  active = false,
  onSelect,
  onReport,
}) {
  const Icon = ICONS[facility.category] ?? Droplet;
  const category = CATEGORIES[facility.category];

  return (
    <article
      className={`facility-card ${active ? 'is-active' : ''}`}
      onClick={() => onSelect?.(facility)}
    >
      <div className="facility-icon" style={{ background: `${category.color}1a`, color: category.color }}>
        <Icon size={18} />
      </div>

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
          <TriangleAlert size={13} /> Report issue
        </button>
      </div>
    </article>
  );
}
