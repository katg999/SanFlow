'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Polyline, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function Fit({ points, fitKey, geoData }) {
  const map = useMap();
  useEffect(() => {
    if (geoData?.features?.length) map.fitBounds(L.geoJSON(geoData).getBounds(), { padding: [20, 20] });
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

const numIcon = (n, color) =>
  L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font:700 12px Inter,sans-serif;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

// markers: {lat,lng,color,label,detail}; heat: {lat,lng,color,radiusM}; zones: {lat,lng,radiusM,color,label};
// stops: ordered {lat,lng,label} drawn as a numbered route.
export default function DashMap({ markers = [], heat = [], zones = [], stops = [], geo, start, height = 420, fitKey = 'x' }) {
  const pts = [...markers, ...stops, ...zones].map((m) => [m.lat, m.lng]);
  const line = start && stops.length ? [[start.lat, start.lng], ...stops.map((s) => [s.lat, s.lng])] : [];
  return (
    <MapContainer center={[-1.2864, 36.8172]} zoom={11} preferCanvas scrollWheelZoom style={{ height, width: '100%', borderRadius: 16 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {geo && (
        <GeoJSON
          key={geo.key}
          data={geo.data}
          style={(f) => geo.style(f.properties)}
          onEachFeature={(f, layer) => geo.tooltip && layer.bindTooltip(geo.tooltip(f.properties), { sticky: true })}
        />
      )}
      {heat.map((h, i) => (
        <Circle key={`h${i}`} center={[h.lat, h.lng]} radius={h.radiusM ?? 450} pathOptions={{ stroke: false, fillColor: h.color, fillOpacity: 0.22 }} />
      ))}
      {zones.map((z) => (
        <Circle key={z.label} center={[z.lat, z.lng]} radius={z.radiusM} pathOptions={{ color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.18 }}>
          <Popup>{z.label}</Popup>
        </Circle>
      ))}
      {markers.map((m, i) => (
        <CircleMarker key={m.id ?? i} center={[m.lat, m.lng]} radius={m.radius ?? 8} pathOptions={{ color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 1 }}>
          <Popup>
            <strong>{m.label}</strong>
            {m.detail && <div>{m.detail}</div>}
          </Popup>
        </CircleMarker>
      ))}
      {line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#2f8ad6', weight: 4, dashArray: '2 8' }} />}
      {start && <CircleMarker center={[start.lat, start.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#12283f', fillOpacity: 1 }}><Popup>Start point (city centre)</Popup></CircleMarker>}
      {stops.map((s, i) => (
        <Marker key={s.id ?? i} position={[s.lat, s.lng]} icon={numIcon(i + 1, '#2f8ad6')}>
          <Popup><strong>Stop {i + 1}</strong><div>{s.label}</div></Popup>
        </Marker>
      ))}
      <Fit points={pts} fitKey={fitKey} geoData={geo?.data} />
    </MapContainer>
  );
}
