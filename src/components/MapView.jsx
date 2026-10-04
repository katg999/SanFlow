'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORIES } from '../data/facilities.js';
import { distanceKm, estimateEta } from '../utils/geo.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import RatingStars from './RatingStars.jsx';
import './MapView.css';

const DEFAULT_CENTER = [0.3136, 32.5811]; // Kampala CBD
const DEFAULT_ZOOM = 13;

function buildIcon(category, active) {
  const color = CATEGORIES[category]?.color ?? '#1b3a5c';
  const size = active ? 34 : 26;

  return L.divIcon({
    className: 'facility-marker-wrapper',
    html: `<span class="facility-marker ${active ? 'is-active' : ''}" style="--marker-color:${color}; width:${size}px; height:${size}px;"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FlyToSelected({ facility }) {
  const map = useMap();

  useEffect(() => {
    if (facility) {
      map.flyTo([facility.lat, facility.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [facility, map]);

  return null;
}

export default function MapView({
  facilities,
  selectedId,
  onSelect,
  onRate,
  onReport,
  userLocation,
}) {
  const mapRef = useRef(null);
  const { t } = useLanguage();
  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === selectedId) || null,
    [facilities, selectedId]
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="map-view"
      ref={mapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={9}
          pathOptions={{ color: '#2f8ad6', fillColor: '#2f8ad6', fillOpacity: 0.35, weight: 2 }}
        />
      )}

      {userLocation && selectedFacility && (
        <Polyline
          positions={[
            [userLocation.lat, userLocation.lng],
            [selectedFacility.lat, selectedFacility.lng],
          ]}
          pathOptions={{ color: '#2f8ad6', weight: 3, dashArray: '6 8', opacity: 0.75 }}
        />
      )}

      {facilities.map((facility) => (
        <Marker
          key={facility.id}
          position={[facility.lat, facility.lng]}
          icon={buildIcon(facility.category, facility.id === selectedId)}
          eventHandlers={{ click: () => onSelect?.(facility) }}
        >
          <Popup>
            <div className="map-popup">
              <h4>{facility.name}</h4>
              <p className="map-popup-area">{facility.area}</p>
              <div className="map-popup-meta">
                <StatusBadge status={facility.status} size="sm" />
                <RatingStars value={facility.rating} count={facility.ratingsCount} size={13} />
              </div>
              {facility.hours && <p className="map-popup-hours">{facility.hours}</p>}
              <p className="map-popup-desc">{facility.description}</p>

              {userLocation && (() => {
                const eta = estimateEta(distanceKm(userLocation, facility));
                return (
                  <p className="map-popup-eta">
                    {t('map.walk', { min: eta.walkMin })} · {t('map.drive', { min: eta.driveMin })}
                  </p>
                );
              })()}

              <div className="map-popup-rate">
                <span>{t('map.rateThis')}</span>
                <RatingStars
                  value={facility.userRating ?? 0}
                  interactive
                  size={16}
                  onRate={(stars) => onRate?.(facility.id, stars)}
                />
              </div>

              <div className="map-popup-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  {t('map.directions')}
                </a>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onReport?.(facility)}
                >
                  {t('map.reportIssue')}
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      <FlyToSelected facility={selectedFacility} />
    </MapContainer>
  );
}
