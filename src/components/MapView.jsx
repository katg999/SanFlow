'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORIES } from '../data/facilities.js';
import { distanceKm, estimateEta } from '../utils/geo.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import RatingStars from './RatingStars.jsx';
import FacilityInfo from './FacilityInfo.jsx';
import './MapView.css';

const DEFAULT_CENTER = [-1.2864, 36.8172]; // Nairobi — the view jumps to the user's area when located
const DEFAULT_ZOOM = 12;

const STATUS_STROKE = { broken: '#d64545', full: '#d64545', closed: '#8a97a6', dirty: '#dd9a2b', filling: '#dd9a2b' };

function markerStyle(facility, selected) {
  const color = CATEGORIES[facility.category]?.color ?? '#1b3a5c';
  const stroke = STATUS_STROKE[facility.status];
  return {
    radius: selected ? 11 : 6,
    color: selected ? '#12283f' : stroke ?? '#ffffff',
    weight: selected ? 3 : stroke ? 3 : 1.5,
    fillColor: color,
    fillOpacity: selected ? 1 : 0.85,
  };
}

// Thousands of facilities: drawn as canvas circles created once per list change (not as DOM markers or React
// elements), with one shared popup. This keeps the map smooth with ~12,000 real OpenStreetMap points.
function FacilityLayer({ facilities, selectedId, onSelect }) {
  const map = useMap();
  const markers = useRef(new Map());
  const selectedRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const renderer = L.canvas({ padding: 0.5 });
    const group = L.layerGroup();
    const byId = new Map();
    for (const f of facilities) {
      const m = L.circleMarker([f.lat, f.lng], { ...markerStyle(f, false), renderer });
      m.on('click', () => onSelectRef.current?.(f));
      group.addLayer(m);
      byId.set(f.id, { marker: m, facility: f });
    }
    group.addTo(map);
    markers.current = byId;
    selectedRef.current = null;
    return () => {
      group.remove();
      markers.current = new Map();
    };
  }, [facilities, map]);

  useEffect(() => {
    const prev = selectedRef.current && markers.current.get(selectedRef.current);
    if (prev) prev.marker.setStyle(markerStyle(prev.facility, false));
    const next = selectedId && markers.current.get(selectedId);
    if (next) {
      next.marker.setStyle(markerStyle(next.facility, true));
      next.marker.bringToFront();
    }
    selectedRef.current = next ? selectedId : null;
  }, [selectedId, facilities]);

  return null;
}

function PickStart({ active, onPick }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = active ? 'crosshair' : '';
    return () => {
      map.getContainer().style.cursor = '';
    };
  }, [active, map]);
  useMapEvents({
    click(e) {
      if (active) onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

const userIcon = L.divIcon({
  className: 'user-marker-wrapper',
  html: '<span class="user-marker"><span class="user-marker-pulse"></span><span class="user-marker-dot"></span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Frame the whole route when navigation starts (or the route is recalculated).
function FitRoute({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route?.coords?.length > 1) {
      map.fitBounds(L.latLngBounds(route.coords), { padding: [60, 60], maxZoom: 18 });
    }
  }, [route, map]);
  return null;
}

// Keep the walker in view while navigating without fighting manual panning.
function FollowUser({ userLocation, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active || !userLocation) return;
    const p = [userLocation.lat, userLocation.lng];
    if (!map.getBounds().pad(-0.25).contains(p)) map.panTo(p, { animate: true });
  }, [userLocation, active, map]);
  return null;
}

function FlyToSelected({ facility, suspended }) {
  const map = useMap();

  useEffect(() => {
    if (facility && !suspended) {
      map.flyTo([facility.lat, facility.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [facility, map, suspended]);

  return null;
}

export default function MapView({
  facilities,
  selectedId,
  onSelect,
  onRate,
  onReport,
  onNavigate,
  onConfirm,
  userLocation,
  route,
  navigating,
  pickingStart,
  onPickStart,
  center,
}) {
  const { t } = useLanguage();
  const selected = useMemo(() => facilities.find((f) => f.id === selectedId) || null, [facilities, selectedId]);

  return (
    <MapContainer
      center={center ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      preferCanvas
      className="map-view"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL) — facility data'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000} interactive={false} />}

      {route?.coords && (
        <>
          <Polyline positions={route.coords} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
          <Polyline positions={route.coords} pathOptions={{ color: '#2f8ad6', weight: 5, opacity: 0.95 }} />
        </>
      )}

      {!route && userLocation && selected && (
        <Polyline
          positions={[[userLocation.lat, userLocation.lng], [selected.lat, selected.lng]]}
          pathOptions={{ color: '#2f8ad6', weight: 3, dashArray: '6 8', opacity: 0.6 }}
        />
      )}

      <FacilityLayer facilities={facilities} selectedId={selectedId} onSelect={onSelect} />

      {selected && (
        <Popup key={selected.id} position={[selected.lat, selected.lng]} offset={[0, -8]}>
          <FacilityPopup facility={selected} userLocation={userLocation} t={t} onRate={onRate} onReport={onReport} onNavigate={onNavigate} onConfirm={onConfirm} />
        </Popup>
      )}

      <PickStart active={pickingStart} onPick={onPickStart} />
      <FitRoute route={route} />
      <FollowUser userLocation={userLocation} active={navigating} />
      <FlyToSelected facility={selected} suspended={Boolean(route)} />
      <FlyToCenter center={center} />
    </MapContainer>
  );
}

function FlyToCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 0.8 });
  }, [center, map]);
  return null;
}

function FacilityPopup({ facility, userLocation, t, onRate, onReport, onNavigate, onConfirm }) {
  const eta = userLocation ? estimateEta(distanceKm(userLocation, facility)) : null;
  return (
    <div className="map-popup">
      <h4>{facility.name}</h4>
      <p className="map-popup-area">{facility.area}</p>
      <div className="map-popup-meta">
        <StatusBadge status={facility.status} size="sm" />
        {facility.ratingsCount > 0 ? <RatingStars value={facility.rating} count={facility.ratingsCount} size={13} /> : <span className="map-popup-hours">No ratings yet</span>}
      </div>
      {facility.access === 'customers' && <p className="map-popup-hours">Customers only — not a public facility</p>}
      {facility.hours && <p className="map-popup-hours">{facility.hours}</p>}
      <FacilityInfo facility={facility} />
      {facility.description && <p className="map-popup-desc">{facility.description}</p>}

      {eta && (
        <p className="map-popup-eta">
          {t('map.walk', { min: eta.walkMin })} · {t('map.drive', { min: eta.driveMin })}
        </p>
      )}

      {facility.category === 'water' && (
        <div className="map-popup-rate">
          <span>Working today?</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onConfirm?.(facility, true)}>Yes</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onConfirm?.(facility, false)}>No</button>
        </div>
      )}

      <div className="map-popup-rate">
        <span>{t('map.rateThis')}</span>
        <RatingStars value={facility.userRating ?? 0} interactive size={16} onRate={(stars) => onRate?.(facility.id, stars)} />
      </div>

      <div className="map-popup-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate?.(facility)}>
          {t('map.directions')}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onReport?.(facility)}>
          {t('map.reportIssue')}
        </button>
      </div>
    </div>
  );
}
