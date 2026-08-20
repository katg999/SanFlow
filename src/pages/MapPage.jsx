import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LocateFixed, Droplet, Trash2, HeartPulse, Bath, LayoutGrid } from 'lucide-react';
import { CATEGORIES } from '../data/facilities.js';
import { useFacilityStore } from '../hooks/useFacilityStore.js';
import { distanceKm, sortByProximity } from '../utils/geo.js';
import MapView from '../components/MapView.jsx';
import FacilityCard from '../components/FacilityCard.jsx';
import ReportAlertModal from '../components/ReportAlertModal.jsx';
import './MapPage.css';

const NAIROBI_CENTER = { lat: -1.2921, lng: 36.8219 };

const FILTERS = [
  { key: 'all', label: 'All', icon: LayoutGrid },
  { key: 'toilet', label: CATEGORIES.toilet.label, icon: Bath },
  { key: 'water', label: CATEGORIES.water.label, icon: Droplet },
  { key: 'waste', label: CATEGORIES.waste.label, icon: Trash2 },
  { key: 'health', label: CATEGORIES.health.label, icon: HeartPulse },
];

export default function MapPage() {
  const { facilities, rateFacility, reportIssue } = useFacilityStore();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(() => searchParams.get('category') ?? 'all');
  const [selectedId, setSelectedId] = useState(() => searchParams.get('focus'));
  const [reportTarget, setReportTarget] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const origin = userLocation ?? NAIROBI_CENTER;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = facilities;

    if (filter !== 'all') {
      list = list.filter((f) => f.category === filter);
    }

    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.area.toLowerCase().includes(q) ||
          f.country.toLowerCase().includes(q)
      );
    }

    return sortByProximity(list, origin);
  }, [facilities, filter, query, origin]);

  useEffect(() => {
    if (filtered.length && !filtered.find((f) => f.id === selectedId)) {
      // Keep selection valid without forcing a fly-to on every filter change.
    }
  }, [filtered, selectedId]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="map-page">
      <aside className="map-sidebar">
        <div className="map-sidebar-header">
          <h2>Find a service near you</h2>
          <p>Results are sorted by distance{userLocation ? ' from your location' : ' from Nairobi CBD'}.</p>

          <div className="map-search">
            <Search size={16} />
            <input
              type="text"
              placeholder='Try "toilet near Kibera" or "borehole"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button type="button" className="map-locate-btn" onClick={handleLocate}>
            <LocateFixed size={15} />
            {locating ? 'Locating…' : userLocation ? 'Using your location' : 'Use my location'}
          </button>

          <div className="map-filters">
            {FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`map-filter-chip ${filter === key ? 'is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-sidebar-list">
          {filtered.length === 0 && (
            <p className="map-empty">No facilities match that search yet.</p>
          )}
          {filtered.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              distanceKm={distanceKm(origin, facility)}
              active={facility.id === selectedId}
              onSelect={(f) => setSelectedId(f.id)}
              onReport={setReportTarget}
            />
          ))}
        </div>
      </aside>

      <div className="map-main">
        <MapView
          facilities={filtered}
          selectedId={selectedId}
          onSelect={(f) => setSelectedId(f.id)}
          onRate={rateFacility}
          onReport={setReportTarget}
          userLocation={userLocation}
        />
      </div>

      <ReportAlertModal
        facility={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={reportIssue}
      />
    </div>
  );
}
