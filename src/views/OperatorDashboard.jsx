'use client';

import { useMemo, useState } from 'react';
import { LayoutDashboard, Bath, Bell, PlusCircle, Sparkles, Camera, Truck, Tag, LocateFixed, Search, HandHelping } from 'lucide-react';
import DashShell from '../components/dash/DashShell.jsx';
import { Kpi, ColumnChart, FillMeter } from '../components/dash/charts.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import RatingStars from '../components/RatingStars.jsx';
import ReportPhoto from '../components/dash/ReportPhoto.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOps } from '../context/OpsContext.jsx';
import { useFacilities } from '../hooks/useFacilities.js';
import { fileToDataUrl } from '../utils/image.js';
import { currencyFor, formatAgo } from '../utils/enrich.js';

const AMENITIES = ['Handwashing', 'Disability access', 'Lighting', 'Female-friendly', 'Baby change'];
const DAYS = ['6d', '5d', '4d', '3d', '2d', 'Yest.', 'Today'];
const REPORT_LABEL = { full: 'Full / septic', broken: 'Broken', dirty: 'Dirty', dumping: 'Dumping' };
const ago = (iso) => formatAgo(Math.round((Date.now() - new Date(iso).getTime()) / 60000));
const noop = () => {};

export default function OperatorDashboard() {
  const { user } = useAuth();
  const ops = useOps();
  const { facilities: all } = useFacilities();
  const [tab, setTab] = useState('overview');

  const mine = useMemo(() => ops.myFacilities.map((f) => ({ ...f, lastCleanedMins: f.lastCleanedAt ? Math.round((Date.now() - new Date(f.lastCleanedAt)) / 60000) : null })), [ops.myFacilities]);
  const myIds = new Set(mine.map((f) => f.id));
  const complaints = ops.reports.filter((r) => myIds.has(r.facilityId));
  const openComplaints = complaints.filter((r) => r.status !== 'resolved');
  const fillAlerts = mine
    .map((f) => ({ f, pct: Math.round(((f.usage ?? 0) / (f.capacity || 400)) * 100) }))
    .filter((x) => x.pct >= 75)
    .sort((a, b) => b.pct - a.pct);

  const totalDaily = DAYS.map((label, i) => ({ label, value: mine.reduce((a, f) => a + (f.daily?.[i] ?? 0), 0), highlight: i === 6 }));
  const todayCustomers = totalDaily[6].value;
  const priced = mine.filter((f) => f.fee != null);
  const income = priced.reduce((a, f) => {
    const disc = f.discount ? 1 - f.discount.pct / 100 : 1;
    return a + (f.daily?.[6] ?? 0) * f.fee * (f.discount ? (disc + 1) / 2 : 1); // assumes about half of customers use a discount
  }, 0);
  const cur = mine[0] ? currencyFor(mine[0].country) : 'KES';
  const rated = mine.filter((f) => f.ratingsCount > 0);
  const avgRating = rated.length ? rated.reduce((a, f) => a + f.rating * f.ratingsCount, 0) / rated.reduce((a, f) => a + f.ratingsCount, 0) : null;

  const tabs = [
    { key: 'overview', label: 'Business overview', icon: LayoutDashboard },
    { key: 'facilities', label: 'My facilities', icon: Bath },
    { key: 'alerts', label: 'Alerts & complaints', icon: Bell, badge: fillAlerts.length + openComplaints.length },
    { key: 'claim', label: 'Claim a facility', icon: HandHelping },
    { key: 'register', label: 'Register new', icon: PlusCircle },
  ];

  return (
    <DashShell role="operator" title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Operator'}`} subtitle="Manage your facilities, respond to alerts and see how your business is doing." tabs={tabs} tab={tab} onTab={setTab}>
      {tab === 'overview' && (
        <>
          {mine.length === 0 && (
            <div className="notice-box">
              You have no facilities yet. Use <b>Claim a facility</b> to take over one that is already on the map, or <b>Register new</b> if it is not listed.
            </div>
          )}
          <div className="dash-row">
            <Kpi label="Customers today" value={todayCustomers} hint="logged via the usage counter" />
            <Kpi label="Income today" value={priced.length ? `${cur} ${Math.round(income).toLocaleString()}` : '—'} hint={priced.length ? `from ${priced.length} facilities with a price set` : 'set a price on a facility'} tone={priced.length ? 'good' : undefined} />
            <Kpi label="Average rating" value={avgRating ? `${avgRating.toFixed(1)}★` : '—'} hint={`${rated.length} rated facilities`} />
            <Kpi label="Open complaints" value={openComplaints.length} tone={openComplaints.length ? 'warning' : undefined} />
            <Kpi label="Fill-level alerts" value={fillAlerts.length} tone={fillAlerts.length ? 'danger' : undefined} />
          </div>
          <div className="dash-grid dash-grid-2">
            <div className="dash-card">
              <h3>Daily customer count — last 7 days</h3>
              <p className="sub">Visits you logged across {mine.length} facilit{mine.length === 1 ? 'y' : 'ies'}.</p>
              {mine.length ? <ColumnChart data={totalDaily} /> : <p className="empty">Claim or register a facility to start tracking customers.</p>}
            </div>
            <div className="dash-card">
              <h3>Ratings &amp; reviews</h3>
              <p className="sub">Community ratings on your facilities.</p>
              {mine.map((f) => (
                <div className="list-item" key={f.id}>
                  <div><h4>{f.name}</h4><StatusBadge status={f.status} size="sm" /></div>
                  {f.ratingsCount > 0 ? <RatingStars value={f.rating} count={f.ratingsCount} size={13} /> : <span className="sub">No ratings yet</span>}
                </div>
              ))}
              {!mine.length && <p className="empty">No facilities yet.</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'facilities' && (
        <div className="dash-stack">
          {!mine.length && <p className="empty dash-card">You have no facilities yet — use “Claim a facility” or “Register new”.</p>}
          {mine.map((f) => <FacilityEditor key={f.id} f={f} ops={ops} />)}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="dash-grid">
          <div className="dash-card">
            <h3>Smart alerts — pit / septic fill level</h3>
            <p className="sub">Estimated from the customers you log (400 uses ≈ full). A sensor can feed the same counter later.</p>
            {fillAlerts.length === 0 && <p className="empty">No tank is above 75%.</p>}
            {fillAlerts.map(({ f, pct }) => (
              <div className="list-item" key={f.id}>
                <div style={{ flex: 1 }}><h4>{f.name}</h4><FillMeter pct={pct} /></div>
                <button type="button" className="btn btn-primary btn-xs" onClick={() => ops.requestPickup(f).catch(noop)}><Truck size={13} /> Request exhauster</button>
              </div>
            ))}
            {ops.jobs.filter((j) => myIds.has(j.facilityId) && j.status !== 'done').map((j) => (
              <p key={j.id} className="sub">🚚 Pickup for {mine.find((f) => f.id === j.facilityId)?.name}: <b>{j.status === 'accepted' ? 'accepted by a provider' : j.providerId ? 'assigned' : 'waiting for a provider'}</b></p>
            ))}
          </div>
          <div className="dash-card">
            <h3>Complaints tracking</h3>
            <p className="sub">Citizen reports about your facilities (verified reports alert you instantly).</p>
            {complaints.length === 0 && <p className="empty">No complaints.</p>}
            {complaints.map((r) => (
              <div className="list-item" key={r.id}>
                <div>
                  <h4>{REPORT_LABEL[r.type]} — {mine.find((f) => f.id === r.facilityId)?.name}</h4>
                  <p>{r.note || 'No details'} · {r.userName} · {ago(r.at)}</p>
                  <ReportPhoto has={r.hasPhoto} inline={r.photo} load={() => ops.loadReportPhoto(r)} />
                </div>
                <span className={`pill ${r.status === 'resolved' ? 'pill-good' : r.verified ? 'pill-bad' : 'pill-warn'}`}>{r.status === 'resolved' ? 'Resolved' : r.verified ? 'Open' : 'Unconfirmed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'claim' && <ClaimPanel all={all} ops={ops} onClaimed={() => setTab('facilities')} />}
      {tab === 'register' && <RegisterForm ops={ops} onDone={() => setTab('facilities')} />}
    </DashShell>
  );
}

// Take responsibility for a facility that is already mapped (from OpenStreetMap) instead of creating a duplicate.
function ClaimPanel({ all, ops, onClaimed }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return all.filter((f) => !f.ownerId && f.access !== 'customers' && ['toilet', 'water'].includes(f.category) && (f.name.toLowerCase().includes(needle) || f.area.toLowerCase().includes(needle))).slice(0, 25);
  }, [all, q]);
  return (
    <div className="dash-card">
      <h3>Claim a facility that is already on the map</h3>
      <p className="sub">Search by name or area. Claiming makes you its operator: you can set its price, hours and amenities, receive alerts and see its customers. Claims are logged and can be reviewed by the municipality.</p>
      <div className="map-search" style={{ marginBottom: 12 }}><Search size={16} /><input placeholder="e.g. Kibera, Kasarani, Kisenyi…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {q.trim().length >= 2 && results.length === 0 && <p className="empty">No unclaimed toilets or water points match.</p>}
      {results.map((f) => (
        <div className="list-item" key={f.id}>
          <div><h4>{f.name}</h4><p>{f.area} · {f.category === 'toilet' ? 'Toilet' : 'Water point'}</p></div>
          <button type="button" className="btn btn-primary btn-xs" onClick={() => ops.claimFacility(f.id).then(onClaimed).catch(noop)}>Claim</button>
        </div>
      ))}
    </div>
  );
}

function FacilityEditor({ f, ops }) {
  const [fee, setFee] = useState(f.fee ?? '');
  const [hours, setHours] = useState(f.hours ?? '');
  const [amenities, setAmenities] = useState(f.amenities ?? []);
  const [disc, setDisc] = useState(f.discount?.pct ?? 0);
  const [visits, setVisits] = useState(10);
  const [saved, setSaved] = useState(false);
  const pct = Math.round(((f.usage ?? 0) / (f.capacity || 400)) * 100);

  const save = async () => {
    try {
      await ops.updateFacility(f.id, {
        ...(fee !== '' ? { fee: Number(fee) } : {}),
        hours,
        amenities,
        discount: Number(disc) > 0 ? { pct: Number(disc), label: `${disc}% discount` } : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // the error banner explains what went wrong
    }
  };
  const addPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (file) await ops.updateFacility(f.id, { photos: [...(f.photos ?? []), await fileToDataUrl(file)] }).catch(noop);
  };

  return (
    <div className="dash-card">
      <div className="list-item" style={{ paddingTop: 0 }}>
        <div>
          <h3>{f.name}</h3>
          <p>{f.area} · last cleaned {f.lastCleanedMins != null ? formatAgo(f.lastCleanedMins) : 'not recorded'}</p>
        </div>
        <div className="list-item-actions">
          <StatusBadge status={f.status} />
          <button type="button" className="btn btn-accent btn-xs" onClick={() => ops.markCleaned(f.id).catch(noop)}><Sparkles size={13} /> Mark cleaned</button>
        </div>
      </div>
      <div style={{ margin: '4px 0 14px' }}><FillMeter pct={pct} /></div>
      <div className="dash-form">
        <div className="dash-form-cols">
          <label>Price per use ({currencyFor(f.country)})<input type="number" min="0" value={fee} placeholder="not set" onChange={(e) => setFee(e.target.value)} /></label>
          <label>Opening hours<input value={hours} onChange={(e) => setHours(e.target.value)} /></label>
          <label><span><Tag size={12} /> Discount % (attracts customers)</span><input type="number" min="0" max="90" value={disc} onChange={(e) => setDisc(e.target.value)} /></label>
        </div>
        <div className="field-label">Amenities
          <div className="check-row">
            {AMENITIES.map((a) => (
              <label key={a}><input type="checkbox" checked={amenities.includes(a)} onChange={() => setAmenities((cur) => cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a])} />{a}</label>
            ))}
          </div>
        </div>
        <div className="field-label">Photos
          <div className="photo-row">
            {(f.photos ?? []).map((p, i) => <img key={i} src={p} alt="Facility" />)}
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}><Camera size={14} /> Upload<input type="file" accept="image/*" hidden onChange={addPhoto} /></label>
          </div>
        </div>
        <div className="list-item-actions" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>{saved ? 'Saved ✓' : 'Save changes'}</button>
          <span className="sub" style={{ marginLeft: 12 }}>Log customers served:</span>
          <input className="dash-select" style={{ width: 80 }} type="number" min="1" max="500" value={visits} onChange={(e) => setVisits(e.target.value)} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => ops.addVisits(f.id, Number(visits)).catch(noop)}>Add</button>
        </div>
      </div>
    </div>
  );
}

function RegisterForm({ ops, onDone }) {
  const [form, setForm] = useState({ name: '', category: 'toilet', area: '', country: 'Kenya', lat: '', lng: '', hours: '', fee: '', description: '' });
  const [amenities, setAmenities] = useState([]);
  const [photo, setPhoto] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const locate = () =>
    navigator.geolocation?.getCurrentPosition((p) => setForm((f) => ({ ...f, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await ops.registerFacility({
        name: form.name.trim(), category: form.category, area: form.area.trim(), country: form.country,
        lat: Number(form.lat), lng: Number(form.lng), hours: form.hours || undefined, fee: form.fee === '' ? undefined : Number(form.fee), amenities,
        description: form.description, photo,
      });
      onDone();
    } catch {
      // the error banner explains what went wrong
    }
  };

  return (
    <form className="dash-card dash-form" onSubmit={submit}>
      <h3>Register a facility that is not on the map</h3>
      <p className="sub">Search “Claim a facility” first — most toilets and water points are already mapped. New facilities appear as “Not yet verified” until the community confirms them.</p>
      <div className="dash-form-cols">
        <label>Name<input required value={form.name} onChange={set('name')} /></label>
        <label>Type<select value={form.category} onChange={set('category')}><option value="toilet">Public toilet</option><option value="water">Water point</option><option value="waste">Waste point</option></select></label>
        <label>Area<input required value={form.area} onChange={set('area')} placeholder="Ward / neighbourhood, city" /></label>
        <label>Country<select value={form.country} onChange={set('country')}><option>Kenya</option><option>Uganda</option></select></label>
        <label>Latitude<input required type="number" step="any" value={form.lat} onChange={set('lat')} /></label>
        <label>Longitude<input required type="number" step="any" value={form.lng} onChange={set('lng')} /></label>
        <label>Price per use (optional)<input type="number" min="0" value={form.fee} onChange={set('fee')} /></label>
        <label>Opening hours (optional)<input value={form.hours} onChange={set('hours')} /></label>
      </div>
      <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: 'start' }} onClick={locate}><LocateFixed size={14} /> Use my current location</button>
      <div className="field-label">Amenities
        <div className="check-row">
          {AMENITIES.map((a) => (
            <label key={a}><input type="checkbox" checked={amenities.includes(a)} onChange={() => setAmenities((c) => c.includes(a) ? c.filter((x) => x !== a) : [...c, a])} />{a}</label>
          ))}
        </div>
      </div>
      <label>Photo<input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && setPhoto(await fileToDataUrl(e.target.files[0]))} /></label>
      {photo && <div className="photo-row"><img src={photo} alt="Preview" /></div>}
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>Register facility</button>
    </form>
  );
}
