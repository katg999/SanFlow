'use client';

import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Search, LocateFixed, Droplet, Trash2, HeartPulse, Bath, LayoutGrid, Plus, Navigation, Trash, Crosshair } from 'lucide-react';
import { useFacilities } from '../hooks/useFacilities.js';
import { useNavigation } from '../hooks/useNavigation.js';
import { nearestUsable } from '../utils/routing.js';
import { distanceKm, sortByProximity } from '../utils/geo.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import FacilityCard from '../components/FacilityCard.jsx';
import ReportAlertModal from '../components/ReportAlertModal.jsx';
import AddFacilityModal from '../components/AddFacilityModal.jsx';
import NavPanel from '../components/NavPanel.jsx';
import './MapPage.css';

const MapView = dynamic(() => import('../components/MapView.jsx'), { ssr: false });

const CITIES = {
  Nairobi: { lat: -1.2864, lng: 36.8172 },
  Kampala: { lat: 0.3136, lng: 32.5811 },
};
const FAR_KM = 50; // beyond this there is no coverage — ask the user to pick a start point on the map
const PAGE = 50;

const FILTER_KEYS = [
  { key: 'all', icon: LayoutGrid },
  { key: 'toilet', icon: Bath },
  { key: 'water', icon: Droplet },
  { key: 'waste', icon: Trash2 },
  { key: 'health', icon: HeartPulse },
];

export default function MapPage() {
  const { facilities, status: loadStatus, rateFacility, addFacility, submitReport, confirmAvailability } = useFacilities();
  const { t } = useLanguage();
  const { user, apiUp, hydrated } = useAuth();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(() => searchParams.get('category') ?? 'all');
  const [selectedId, setSelectedId] = useState(() => searchParams.get('focus'));
  const [reportTarget, setReportTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [city, setCity] = useState('Nairobi');
  const [mapCenter, setMapCenter] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationSource, setLocationSource] = useState(null); // 'gps' | 'picked'
  const [pickingStart, setPickingStart] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const [pendingNav, setPendingNav] = useState(() => (searchParams.get('navigate') === '1' ? searchParams.get('focus') : null));
  const nav = useNavigation({ userLocation, setUserLocation, locationSource });

  const origin = userLocation ?? CITIES[city];

  // What matches the filters (shown on the map) — separate from the proximity-sorted, paged sidebar list.
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities.filter(
      (f) => (filter === 'all' || f.category === filter) && (!q || f.name.toLowerCase().includes(q) || f.area.toLowerCase().includes(q))
    );
  }, [facilities, filter, query]);

  const sorted = useMemo(() => sortByProximity(matching, origin), [matching, origin]);

  useEffect(() => setVisible(PAGE), [filter, query, origin]);

  const nearestToAny = (loc) => facilities.reduce((min, f) => Math.min(min, distanceKm(loc, f)), Infinity);

  // Resolve the user's position; `onReady` runs once we have one.
  const acquireLocation = (onReady) => {
    if (userLocation) {
      onReady(userLocation);
      return;
    }
    if (!navigator.geolocation) {
      setNotice('Location is not available in this browser — use "Pick start point on map".');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocating(false);
        if (nearestToAny(loc) > FAR_KM) {
          setNotice('You appear to be outside our coverage areas (Nairobi & Kampala). Use "Pick start point on map" to choose where you are.');
          return;
        }
        setNotice(null);
        setUserLocation(loc);
        setLocationSource('gps');
        onReady(loc);
      },
      () => {
        setLocating(false);
        setNotice('Could not get your location. Allow location access, or use "Pick start point on map".');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleLocate = () => acquireLocation(() => {});

  // Start point chosen by clicking the map (GPS denied, planning a trip, or on a desktop).
  const handlePickStart = (loc) => {
    nav.stop();
    setPickingStart(false);
    setNotice(null);
    setUserLocation(loc);
    setLocationSource('picked');
  };

  const chooseCity = (name) => {
    setCity(name);
    setMapCenter([CITIES[name].lat, CITIES[name].lng]);
  };

  const startNavigation = (facility, from = userLocation) => {
    if (!from) {
      acquireLocation((loc) => startNavigation(facility, loc));
      return;
    }
    setSelectedId(facility.id);
    nav.start(facility, from);
  };

  const goNearestToilet = () =>
    acquireLocation((loc) => {
      const hit = nearestUsable(facilities, loc, 'toilet');
      if (!hit) {
        setNotice('No usable public toilet found — all known toilets are reported broken, full, closed or customers-only.');
        return;
      }
      startNavigation(hit.facility, loc);
    });

  // Deep link from the chatbot: /map?focus=<id>&navigate=1
  useEffect(() => {
    if (!pendingNav) return;
    const target = facilities.find((f) => f.id === pendingNav);
    if (!target) return;
    setPendingNav(null);
    startNavigation(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNav, facilities]);

  const navigating = nav.status !== 'idle';
  const navFacility = nav.target ? facilities.find((f) => f.id === nav.target.id) ?? nav.target : null;
  const reportOpen = Boolean(reportTarget);
  const reportFacility = reportTarget === 'dumping' ? null : reportTarget;
  const counts = useMemo(() => {
    const c = { toilet: 0, water: 0, waste: 0, health: 0 };
    facilities.forEach((f) => { c[f.category] += 1; });
    return c;
  }, [facilities]);

  if (hydrated && (!apiUp || loadStatus === 'error')) {
    return (
      <div className="map-page map-page-error">
        <div className="map-error-card">
          <h2>Can&apos;t reach the SanFlow server</h2>
          <p>
            Facility data is loaded live from the SanFlow database and none is stored in your browser, so there is nothing to show
            until the connection is back. Please check your connection and reload the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <aside className="map-sidebar">
        {navigating && navFacility ? (
          <NavPanel
            nav={nav}
            facility={navFacility}
            onRate={rateFacility}
            onConfirm={confirmAvailability}
            onReport={setReportTarget}
            onClose={nav.stop}
          />
        ) : (
          <>
            <div className="map-sidebar-header">
              <h2>{t('map.title')}</h2>
              <p>
                {userLocation
                  ? locationSource === 'picked' ? 'Sorted by distance from the start point you picked.' : t('map.subtitleWithLocation')
                  : `Sorted by distance from ${city} city centre.`}
              </p>
              <p className="map-osm-note">
                {loadStatus === 'loading'
                  ? 'Loading facilities…'
                  : `${facilities.length.toLocaleString()} mapped: ${counts.toilet.toLocaleString()} toilets · ${counts.water.toLocaleString()} water points · ${counts.waste.toLocaleString()} waste points · ${counts.health.toLocaleString()} health`}
              </p>

              <div className="map-search">
                <Search size={16} />
                <input type="text" placeholder={t('map.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              <button type="button" className="btn btn-accent btn-sm map-nearest-btn" onClick={goNearestToilet}>
                <Navigation size={15} /> {locating ? t('map.locating') : 'Take me to the nearest toilet'}
              </button>

              {notice && <p className="map-notice">{notice}</p>}

              <div className="map-city-jump">
                <span>Go to:</span>
                {Object.keys(CITIES).map((name) => (
                  <button key={name} type="button" className={city === name ? 'is-active' : ''} onClick={() => chooseCity(name)}>{name}</button>
                ))}
              </div>

              <button type="button" className="map-locate-btn" onClick={handleLocate}>
                <LocateFixed size={15} />
                {locating ? t('map.locating') : userLocation && locationSource === 'gps' ? t('map.usingLocation') : t('map.locate')}
              </button>

              <button type="button" className={`map-locate-btn ${pickingStart ? 'is-on' : ''}`} onClick={() => setPickingStart((v) => !v)}>
                <Crosshair size={15} /> {pickingStart ? 'Click the map to set your start point…' : 'Pick start point on map'}
              </button>

              <button type="button" className="map-locate-btn" onClick={() => setReportTarget('dumping')}>
                <Trash size={15} /> Report illegal dumping
              </button>

              <button
                type="button"
                className="map-locate-btn"
                onClick={() => {
                  if (!user) {
                    window.location.href = '/login';
                    return;
                  }
                  setAddOpen(true);
                }}
              >
                <Plus size={15} /> Add a facility
              </button>

              <div className="map-filters">
                {FILTER_KEYS.map(({ key, icon: Icon }) => (
                  <button key={key} type="button" className={`map-filter-chip ${filter === key ? 'is-active' : ''}`} onClick={() => setFilter(key)}>
                    <Icon size={13} /> {t(`categories.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="map-sidebar-list">
              {sorted.length === 0 && <p className="map-empty">{t('map.empty')}</p>}
              {sorted.slice(0, visible).map((facility) => (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  distanceKm={distanceKm(origin, facility)}
                  showEta={Boolean(userLocation)}
                  active={facility.id === selectedId}
                  onSelect={(f) => setSelectedId(f.id)}
                  onReport={setReportTarget}
                  onNavigate={startNavigation}
                />
              ))}
              {sorted.length > visible && (
                <button type="button" className="btn btn-outline btn-sm map-more" onClick={() => setVisible((v) => v + PAGE)}>
                  Show {Math.min(PAGE, sorted.length - visible)} more ({(sorted.length - visible).toLocaleString()} remaining)
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      <div className="map-main">
        <MapView
          facilities={matching}
          selectedId={selectedId}
          onSelect={(f) => setSelectedId(f.id)}
          onRate={rateFacility}
          onReport={setReportTarget}
          onNavigate={startNavigation}
          onConfirm={confirmAvailability}
          userLocation={userLocation}
          route={navigating ? nav.route : null}
          navigating={nav.status === 'active'}
          pickingStart={pickingStart}
          onPickStart={handlePickStart}
          center={mapCenter}
        />
      </div>

      <ReportAlertModal
        open={reportOpen}
        facility={reportFacility}
        dumping={reportTarget === 'dumping'}
        userLocation={userLocation}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
      />

      <AddFacilityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (input) => {
          const created = await addFacility(input);
          setSelectedId(created.id);
        }}
        defaultLocation={userLocation ?? CITIES[city]}
      />
    </div>
  );
}
