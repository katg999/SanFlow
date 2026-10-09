'use client';

import { ArrowLeft, Footprints, Navigation, Flag, MapPinCheck, TriangleAlert, ArrowUp, CornerUpLeft, CornerUpRight, RotateCcw } from 'lucide-react';
import { formatDistance } from '../utils/geo.js';
import StatusBadge from './StatusBadge.jsx';
import RatingStars from './RatingStars.jsx';
import FacilityInfo from './FacilityInfo.jsx';
import './NavPanel.css';

function StepIcon({ step }) {
  const m = step?.modifier ?? '';
  if (step?.type === 'arrive') return <Flag size={22} />;
  if (m.includes('left')) return <CornerUpLeft size={22} />;
  if (m.includes('right')) return <CornerUpRight size={22} />;
  if (m === 'uturn') return <RotateCcw size={22} />;
  return <ArrowUp size={22} />;
}

export default function NavPanel({ nav, facility, onRate, onConfirm, onReport, onClose }) {
  const { route, status, remainingM, remainingMin, stepIndex, rerouted } = nav;
  const arrived = status === 'arrived';
  const current = route?.steps?.[stepIndex];
  const upcoming = route?.steps?.slice(stepIndex + 1) ?? [];

  return (
    <div className="nav-panel">
      <div className="nav-head">
        <button type="button" className="nav-back" onClick={onClose}>
          <ArrowLeft size={16} /> Back to results
        </button>
        <h2>{arrived ? 'You have arrived' : 'Walking directions'}</h2>
        <p className="nav-dest">{facility.name}</p>
        <div className="nav-dest-meta">
          <StatusBadge status={facility.status} size="sm" />
          <span>{facility.area}</span>
        </div>
        <FacilityInfo facility={facility} compact />
      </div>

      {status === 'routing' && <p className="nav-loading">Finding the best walking route…</p>}

      {arrived ? (
        <div className="nav-arrived">
          <MapPinCheck size={34} />
          <h3>You&apos;re at {facility.name}</h3>
          <p>Help the next person — how was it?</p>
          <div className="nav-rate">
            <RatingStars value={facility.userRating ?? 0} interactive size={26} onRate={(s) => onRate(facility.id, s)} />
          </div>
          {facility.category === 'water' && (
            <div className="nav-confirm">
              <span>Is this water point working today?</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onConfirm(facility, true)}>Yes</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onConfirm(facility, false)}>No</button>
            </div>
          )}
          <div className="nav-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onReport(facility)}>
              <TriangleAlert size={14} /> Report an issue
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        route && (
          <>
            <div className="nav-now">
              <div className="nav-now-icon"><StepIcon step={current} /></div>
              <div>
                <strong>{current?.text ?? 'Follow the route'}</strong>
                {current && current.distance > 0 && <span>for {formatDistance(current.distance / 1000)}</span>}
              </div>
            </div>

            <div className="nav-stats">
              <div><Navigation size={14} /><strong>{formatDistance((remainingM ?? route.distance) / 1000)}</strong><span>remaining</span></div>
              <div><Footprints size={14} /><strong>{Math.max(1, Math.round(remainingMin ?? route.duration / 60))} min</strong><span>walking</span></div>
            </div>

            {route.source === 'estimate' && (
              <p className="nav-note">Street routing is unavailable offline — showing a straight-line estimate.</p>
            )}
            {rerouted > 0 && <p className="nav-note nav-note-ok">Route updated — you went off the path ({rerouted}×).</p>}

            <div className="nav-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onReport(facility)}>
                <TriangleAlert size={14} /> Report
              </button>
            </div>

            {upcoming.length > 0 && (
              <ol className="nav-steps">
                {upcoming.map((s, i) => (
                  <li key={`${stepIndex}-${i}`}>
                    <span>{s.text}</span>
                    {s.distance > 0 && <em>{formatDistance(s.distance / 1000)}</em>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )
      )}
    </div>
  );
}
