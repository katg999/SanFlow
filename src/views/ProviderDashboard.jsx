'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Inbox, Route, Receipt, UserSquare2, Leaf, Camera, Printer, X } from 'lucide-react';
import DashShell from '../components/dash/DashShell.jsx';
import { Kpi, BarList } from '../components/dash/charts.jsx';
import ReportPhoto from '../components/dash/ReportPhoto.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOps } from '../context/OpsContext.jsx';
import { useFacilities } from '../hooks/useFacilities.js';
import { deliveredVolume, optimizeRoute, pathKm } from '../utils/analytics.js';
import { fileToDataUrl } from '../utils/image.js';
import { formatAgo } from '../utils/enrich.js';
import { printPage } from '../utils/export.js';
import './dash/Provider.css';

const DashMap = dynamic(() => import('../components/dash/DashMap.jsx'), { ssr: false });

const JOB_LABEL = { pit: 'Pit / septic emptying', waste: 'Waste collection', water: 'Water point repair' };
const KIND_JOBS = { 'Sewage exhauster': ['pit'], 'Waste collector': ['waste'], 'Water point repair': ['water'] };
const PRIORITY_TONE = { high: 'pill-bad', medium: 'pill-warn', low: '' };
// Route start: the centre of the provider's zone (a real coordinate; the provider can change zone in their profile).
const DEPOTS = { Nairobi: { lat: -1.2864, lng: 36.8172 }, Kampala: { lat: 0.3136, lng: 32.5811 } };
const PROVIDER_KINDS = ['Sewage exhauster', 'Waste collector', 'Water point repair'];
const ago = (iso) => formatAgo(Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export default function ProviderDashboard() {
  const { user } = useAuth();
  const ops = useOps();
  const { facilities } = useFacilities();
  const [tab, setTab] = useState('jobs');
  const [completing, setCompleting] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [optimised, setOptimised] = useState(false);

  const providerId = user?.orgId;
  const me = ops.providers.find((p) => p.id === providerId) ?? { id: providerId, name: user?.name, zone: 'Nairobi', kind: 'Sewage exhauster', licensed: false, rating: 0, services: [], fleet: 1 };
  const types = useMemo(() => KIND_JOBS[me.kind] ?? ['pit', 'waste', 'water'], [me.kind]);

  const loc = (j) => {
    const f = facilities.find((x) => x.id === j.facilityId);
    return { lat: j.lat ?? f?.lat, lng: j.lng ?? f?.lng, name: f?.name ?? 'Illegal dumping site', area: f?.area ?? 'GPS pin' };
  };
  const jobs = useMemo(
    () => ops.jobs.filter((j) => types.includes(j.type) && (j.providerId === providerId || (!j.providerId && j.zone === me.zone))),
    [ops.jobs, providerId, me.zone, types]
  );
  const open = jobs.filter((j) => j.status !== 'done');
  const done = ops.jobs.filter((j) => j.status === 'done' && j.providerId === providerId);
  const accepted = open.filter((j) => j.status === 'accepted');
  const depot = DEPOTS[me.zone] ?? DEPOTS.Nairobi;

  const routeStops = open.map((j) => ({ id: j.id, ...loc(j), label: `${loc(j).name} — ${JOB_LABEL[j.type]}` })).filter((s) => s.lat != null);
  const plan = optimizeRoute(depot, routeStops);
  const naiveKm = pathKm(depot, routeStops);
  const savedKm = Math.max(0, naiveKm - plan.km);
  const impact = deliveredVolume(done);
  const earnings = done.reduce((a, j) => a + (j.amountKES ?? 0), 0);

  const tabs = [
    { key: 'jobs', label: 'Jobs & alerts', icon: Inbox, badge: open.length },
    { key: 'route', label: 'Route optimisation', icon: Route },
    { key: 'receipts', label: 'Receipts', icon: Receipt },
    { key: 'impact', label: 'Circular impact', icon: Leaf },
    { key: 'profile', label: 'Public profile', icon: UserSquare2 },
  ];

  return (
    <DashShell role="provider" title={me.name} subtitle={`${me.kind} · zone: ${me.zone}. Priority alerts for full pits and broken water points land here.`} tabs={tabs} tab={tab} onTab={setTab}>
      {tab === 'jobs' && (
        <>
          <div className="dash-row">
            <Kpi label="Open jobs in zone" value={open.length} tone={open.length ? 'warning' : undefined} />
            <Kpi label="High priority" value={open.filter((j) => j.priority === 'high').length} tone="danger" />
            <Kpi label="Accepted" value={accepted.length} />
            <Kpi label="Completed" value={done.length} tone="good" />
            <Kpi label="Earned (KES)" value={earnings ? earnings.toLocaleString() : '—'} />
          </div>
          <div className="dash-card">
            <h3>Job &amp; alert queue</h3>
            <p className="sub">Priority alerts for full pits/septics and broken water points in your zone.</p>
            {open.length === 0 && <p className="empty">No open jobs — all clear.</p>}
            {[...open].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority)).map((j) => {
              const l = loc(j);
              return (
                <div className="list-item" key={j.id}>
                  <div>
                    <h4>{JOB_LABEL[j.type]} — {l.name}</h4>
                    <p>{l.area} · raised {ago(j.createdAt)}</p>
                  </div>
                  <div className="list-item-actions">
                    <span className={`pill ${PRIORITY_TONE[j.priority]}`}>{j.priority}</span>
                    {j.status === 'accepted' ? (
                      <button type="button" className="btn btn-accent btn-xs" onClick={() => setCompleting(j)}>Mark as done</button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => ops.acceptJob(j.id, providerId).catch(() => {})}>Accept</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'route' && (
        <div className="dash-grid dash-grid-2">
          <div className="dash-card">
            <h3>All jobs on the map</h3>
            <p className="sub">Numbered stops follow the optimised order; the dotted line starts at your depot.</p>
            <DashMap start={depot} stops={optimised ? plan.order : []} markers={optimised ? [] : routeStops.map((s) => ({ ...s, color: '#d64545', detail: s.label }))} fitKey={`${optimised}-${routeStops.length}`} height={440} />
          </div>
          <div className="dash-card">
            <h3>Route optimisation</h3>
            <p className="sub">Nearby jobs are grouped into one trip to save fuel and time.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOptimised(true)} disabled={!routeStops.length}>Optimise my route</button>
            {optimised && routeStops.length > 0 && (
              <>
                <div className="dash-row" style={{ marginTop: 14, gridTemplateColumns: '1fr 1fr' }}>
                  <Kpi label="Optimised trip" value={`${plan.km.toFixed(1)} km`} tone="good" />
                  <Kpi label="Fuel saved" value={`~${(savedKm * 0.35).toFixed(1)} L`} hint={`${savedKm.toFixed(1)} km less than list order`} />
                </div>
                <ol className="route-list" style={{ listStylePosition: 'inside', listStyleType: 'decimal' }}>
                  {plan.order.map((s) => <li key={s.id}>{s.label}</li>)}
                </ol>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'receipts' && (
        <div className="dash-card">
          <h3>Completed jobs &amp; digital receipts</h3>
          {done.length === 0 && <p className="empty">Completed jobs appear here with a printable receipt.</p>}
          <div className="table-wrap">
            <table className="dash-table">
              <thead><tr><th>Receipt</th><th>Job</th><th>Facility</th><th>Volume</th><th>Amount</th><th /></tr></thead>
              <tbody>
                {done.map((j) => (
                  <tr key={j.id}>
                    <td>{j.receiptNo}</td><td>{JOB_LABEL[j.type]}</td><td>{loc(j).name}</td><td>{j.volumeM3 ?? 0} m³</td><td>KES {(j.amountKES ?? 0).toLocaleString()}</td>
                    <td><button type="button" className="btn btn-outline btn-xs" onClick={() => setReceipt(j)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'impact' && <CircularPanel done={done} impact={impact} partners={ops.partners} />}

      {tab === 'profile' && <ProfileEditor me={me} done={done.length} ops={ops} />}

      {completing && (
        <CompleteModal
          job={completing}
          loc={loc(completing)}
          partners={ops.partners}
          onClose={() => setCompleting(null)}
          onSubmit={async (data) => {
            const finished = await ops.completeJob(completing.id, { ...data, providerId });
            setReceipt(finished);
            setCompleting(null);
            setTab('receipts');
          }}
        />
      )}
      {receipt && <ReceiptModal job={receipt} loc={loc(receipt)} provider={me} partners={ops.partners} ops={ops} onClose={() => setReceipt(null)} />}
    </DashShell>
  );
}

export function CircularPanel({ done, impact, partners }) {
  const byPartner = partners.map((p) => ({ label: p.name, value: done.filter((j) => j.destination === p.id).reduce((a, j) => a + (j.volumeM3 ?? 0), 0) }));
  return (
    <div className="dash-grid">
      <div className="dash-card">
        <h3>Waste delivered to treatment partners</h3>
        <p className="sub">Waste is a resource: each load can be routed to a partner that turns it into fertilizer, biogas or briquettes.</p>
        {partners.length ? <BarList data={byPartner} unit=" m³" /> : <p className="empty">No treatment partners are registered yet — the municipality adds them under “Treatment partners”.</p>}
      </div>
      <div className="dash-card">
        <h3>Measured volume</h3>
        <div className="dash-row" style={{ gridTemplateColumns: '1fr' }}>
          <Kpi label="Delivered to treatment" value={`${impact.m3} m³`} tone={impact.m3 ? 'good' : undefined} />
        </div>
        <p className="sub">Only volume recorded on completed jobs with a registered treatment partner is counted. No climate (CO₂e) figure is shown: that needs a verified methodology.</p>
      </div>
    </div>
  );
}

function CompleteModal({ job, loc, partners, onClose, onSubmit }) {
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [vol, setVol] = useState(job.type === 'water' ? 0 : 6);
  const [amount, setAmount] = useState(job.type === 'pit' ? 9000 : job.type === 'waste' ? 7000 : 4500);
  const [dest, setDest] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = (set) => async (e) => e.target.files?.[0] && set(await fileToDataUrl(e.target.files[0]));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <form className="dash-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ before, after, volumeM3: Number(vol), amountKES: Number(amount), destination: job.type === 'water' || !dest ? undefined : dest }); } catch { setBusy(false); } }}>
          <h3>Complete job</h3>
          <p className="sub">{JOB_LABEL[job.type]} — {loc.name}</p>
          <div className="dash-form-cols">
            {[['Before photo', before, setBefore], ['After photo', after, setAfter]].map(([label, val, set]) => (
              <div className="field-label" key={label}>{label}
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}><Camera size={14} /> {val ? 'Change' : 'Upload'}<input type="file" accept="image/*" capture="environment" hidden onChange={pick(set)} /></label>
                {val && <div className="photo-row"><img src={val} alt={label} /></div>}
              </div>
            ))}
          </div>
          <div className="dash-form-cols">
            {job.type !== 'water' && <label>Volume collected (m³)<input type="number" min="0" step="0.5" value={vol} onChange={(e) => setVol(e.target.value)} /></label>}
            <label>Amount charged (KES)<input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            {job.type !== 'water' && <label>Delivered to<select value={dest} onChange={(e) => setDest(e.target.value)}><option value="">No treatment partner</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.product})</option>)}</select></label>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={!before || !after || busy}>{busy ? 'Saving…' : <>Mark done &amp; generate receipt</>}</button>
          {(!before || !after) && <p className="sub">Before and after photos are required.</p>}
        </form>
      </div>
    </div>
  );
}

function ReceiptModal({ job, loc, provider, partners, ops, onClose }) {
  const [photos, setPhotos] = useState({ before: job.before, after: job.after });
  const partner = (id) => partners.find((p) => p.id === id);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close no-print" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="receipt">
          <h2>Digital receipt {job.receiptNo ?? ''}</h2>
          <p>SanFlow &amp; WASHLink · {new Date(job.completedAt ?? Date.now()).toLocaleString()}</p>
          <table>
            <tbody>
              <tr><td>Service provider</td><td>{provider.name}</td></tr>
              <tr><td>Service</td><td>{JOB_LABEL[job.type]}</td></tr>
              <tr><td>Facility</td><td>{loc.name}, {loc.area}</td></tr>
              {job.type !== 'water' && <tr><td>Volume</td><td>{job.volumeM3 ?? 0} m³</td></tr>}
              {job.destination && <tr><td>Delivered to</td><td>{partner(job.destination)?.name}</td></tr>}
              <tr><td><b>Total</b></td><td><b>KES {(job.amountKES ?? 0).toLocaleString()}</b></td></tr>
            </tbody>
          </table>
          {photos.before ? (
            <div className="photo-row"><img src={photos.before} alt="Before" />{photos.after && <img src={photos.after} alt="After" />}</div>
          ) : (
            <ReportPhoto has={job.hasPhotos} load={async () => { const p = await ops.loadJobPhotos(job); setPhotos(p); return p.before; }} alt="Before/after photos" />
          )}
        </div>
        <button type="button" className="btn btn-primary btn-sm no-print" style={{ marginTop: 16 }} onClick={printPage}><Printer size={14} /> Print / save as PDF</button>
      </div>
    </div>
  );
}

function ProfileEditor({ me, done, ops }) {
  const [form, setForm] = useState({ name: me.name ?? '', providerKind: me.kind ?? PROVIDER_KINDS[0], zone: me.zone ?? 'Nairobi', phone: me.phone ?? '', fleet: me.fleet ?? 1, licenceNo: me.licenceNo ?? '', services: (me.services ?? []).join(', ') });
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try {
      await ops.updateProfile({ ...form, fleet: Number(form.fleet), services: form.services.split(',').map((x) => x.trim()).filter(Boolean) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // the error banner explains what went wrong
    }
  };
  return (
    <form className="dash-card dash-form" onSubmit={save}>
      <h3>Public profile</h3>
      <p className="sub">Visible to facility operators and municipalities looking for services. Set your service type and zone so you only see the jobs you can do. {done} job{done === 1 ? '' : 's'} completed on SanFlow so far.</p>
      <div className="dash-form-cols">
        <label>Business name<input required value={form.name} onChange={set('name')} /></label>
        <label>Service type<select value={form.providerKind} onChange={set('providerKind')}>{PROVIDER_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label>Zone<select value={form.zone} onChange={set('zone')}><option>Nairobi</option><option>Kampala</option></select></label>
        <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
        <label>Vehicles / crews<input type="number" min="1" value={form.fleet} onChange={set('fleet')} /></label>
        <label>Licence number<input value={form.licenceNo} onChange={set('licenceNo')} /></label>
      </div>
      <label>Services offered (comma-separated)<input value={form.services} onChange={set('services')} /></label>
      <p className="sub">Licence status is verified by the municipality: {me.licensed ? 'licensed ✓' : 'not yet verified'}.</p>
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>{saved ? 'Saved ✓' : 'Save profile'}</button>
    </form>
  );
}
