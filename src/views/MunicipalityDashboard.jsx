'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon, Scale, ShieldCheck, Inbox, BarChart3, Megaphone, Download, Printer, TriangleAlert, Factory } from 'lucide-react';
import DashShell from '../components/dash/DashShell.jsx';
import { Kpi, StackBar, BarList, ColumnChart } from '../components/dash/charts.jsx';
import ReportPhoto from '../components/dash/ReportPhoto.jsx';
import { CircularPanel } from './ProviderDashboard.jsx';
import { useOps } from '../context/OpsContext.jsx';
import { useFacilities } from '../hooks/useFacilities.js';
import { avgResolutionHours, daysBroken, deliveredVolume, isFunctional, needsAttention } from '../utils/analytics.js';
import { downloadCsv, printPage } from '../utils/export.js';
import { formatAgo } from '../utils/enrich.js';
import { apiFetch } from '../utils/api.js';
import { ATTRIBUTION } from '../data/attribution.js';

const DashMap = dynamic(() => import('../components/dash/DashMap.jsx'), { ssr: false });

const GOOD = '#23a382';
const WARN = '#dd9a2b';
const BAD = '#d64545';
const UNKNOWN = '#8aa0b4';
const REPORT_LABEL = { full: 'Full / septic', broken: 'Broken', dirty: 'Dirty', dumping: 'Illegal dumping' };
const ago = (iso) => formatAgo(Math.round((Date.now() - new Date(iso).getTime()) / 60000));
const DAY = 86400000;
const noop = () => {};
const PROBLEM = new Set(['broken', 'closed', 'full', 'dirty', 'filling']);

export default function MunicipalityDashboard() {
  const ops = useOps();
  const { facilities } = useFacilities();
  const [tab, setTab] = useState('gis');
  const [layer, setLayer] = useState('status');
  const [geo, setGeo] = useState(null);
  const [mapCity, setMapCity] = useState('Nairobi');
  const [notice, setNotice] = useState({ title: '', body: '', area: 'All areas', sms: false, app: true });
  const [sent, setSent] = useState(false);
  const [partner, setPartner] = useState({ name: '', product: '' });

  // Real ward polygons (OpenStreetMap) for the coverage map.
  useEffect(() => {
    apiFetch('/api/analytics/wards.geojson').then(setGeo).catch(() => setGeo(null));
  }, []);

  const wards = ops.wardStats ?? [];
  const owned = ops.myFacilities;
  const toilets = facilities.filter((f) => f.category === 'toilet');
  const problems = facilities.filter((f) => PROBLEM.has(f.status));
  const openReports = ops.reports.filter((r) => r.status !== 'resolved' && r.verified);
  const resHours = avgResolutionHours(ops.reports);
  const brokenAlerts = facilities
    .map((f) => ({ f, days: daysBroken(f, ops.reports) }))
    .filter((x) => x.days >= 3 && x.f.category !== 'toilet')
    .sort((a, b) => b.days - a.days)
    .slice(0, 15);
  const gapAlerts = wards.filter((w) => w.gap > 0).sort((a, b) => b.gap - a.gap);
  const doneJobs = ops.jobs.filter((j) => j.status === 'done');
  const impact = deliveredVolume(ops.jobs);

  const colorFor = (f) => (['broken', 'closed'].includes(f.status) ? BAD : WARN);
  const markers = problems
    .filter((f) => layer !== 'clean' || f.category === 'toilet')
    .map((f) => ({ id: f.id, lat: f.lat, lng: f.lng, color: colorFor(f), label: f.name, detail: `${f.category} · ${f.status}` }));
  const heat = problems.filter((f) => ['broken', 'full'].includes(f.status)).map((f) => ({ lat: f.lat, lng: f.lng, color: BAD, radiusM: 650 }));

  const coverageColor = (p) => (p == null ? UNKNOWN : p >= 100 ? GOOD : p >= 50 ? WARN : BAD);
  const wardById = useMemo(() => Object.fromEntries(wards.map((w) => [w.id, w])), [wards]);
  // Nairobi and Kampala are ~500 km apart: show one city's wards at a time so the map can zoom in on them.
  const cityGeo = geo ? { ...geo, features: geo.features.filter((f) => (wardById[f.properties.id]?.city ?? f.properties.city) === mapCity) } : null;
  const geoLayer = layer === 'coverage' && cityGeo
    ? {
        key: `coverage-${wards.length}-${mapCity}`,
        data: cityGeo,
        style: (p) => ({ color: '#ffffff', weight: 1, fillColor: coverageColor(wardById[p.id]?.coveragePct), fillOpacity: 0.55 }),
        tooltip: (p) => {
          const w = wardById[p.id];
          return w ? `${w.name}: ${w.population != null ? `${w.working} of ${w.required} toilets needed · pop. ${w.population.toLocaleString()}` : 'population not available'}` : p.name;
        },
      }
    : null;

  const assignOptions = [
    ...ops.providers.map((p) => ({ key: `provider:${p.id}`, kind: 'provider', id: p.id, name: p.name })),
    ...ops.operators.map((o) => ({ key: `operator:${o.id}`, kind: 'operator', id: o.id, name: o.name })),
  ];

  const trend = Array.from({ length: 7 }, (_, i) => {
    const day = 6 - i;
    const count = ops.reports.filter((r) => r.type === 'dirty' && Math.floor((Date.now() - new Date(r.at)) / DAY) === day).length;
    return { label: day === 0 ? 'Today' : `${day}d`, value: count, highlight: day === 0 };
  });
  const usage = Array.from({ length: 7 }, (_, i) => ({
    label: ['6d', '5d', '4d', '3d', '2d', 'Yest.', 'Today'][i],
    value: owned.reduce((a, f) => a + (f.daily?.[i] ?? 0), 0),
    highlight: i === 6,
  }));

  const tabs = [
    { key: 'gis', label: 'GIS dashboard', icon: MapIcon },
    { key: 'gaps', label: 'Gap analysis', icon: Scale, badge: gapAlerts.length },
    { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { key: 'reports', label: 'Citizen reports', icon: Inbox, badge: openReports.length },
    { key: 'analytics', label: 'Reports & analytics', icon: BarChart3 },
    { key: 'partners', label: 'Treatment partners', icon: Factory },
    { key: 'comms', label: 'Communication', icon: Megaphone },
  ];

  const exportFacilities = () => downloadCsv('facilities.csv', facilities.map((f) => ({ id: f.id, name: f.name, category: f.category, area: f.area, country: f.country, status: f.status, access: f.access, rating: f.ratingsCount ? f.rating : '', ratings: f.ratingsCount, fee: f.fee ?? '', licensed: f.licensed ?? '', lat: f.lat, lng: f.lng })), ATTRIBUTION);
  const exportReports = () => downloadCsv('citizen-reports.csv', ops.reports.map((r) => ({ id: r.id, type: r.type, facility: r.facilityId ?? 'gps pin', reporter: r.userName, at: r.at, verified: r.verified, status: r.status, assigned_to: r.assignedTo?.name ?? '', resolved_at: r.resolvedAt ?? '' })), ATTRIBUTION);
  const exportWards = () => downloadCsv('ward-gap-analysis.csv', wards.map((w) => ({ ward: w.name, city: w.city, population: w.population ?? '', population_source: w.populationSource ?? '', toilets_mapped: w.toilets, toilets_not_reported_broken: w.working, toilets_required: w.required ?? '', gap: w.gap ?? '', coverage_pct: w.coveragePct ?? '', broken_water_points: w.brokenWater, risk: w.riskLevel })), ATTRIBUTION);

  const send = (e) => {
    e.preventDefault();
    ops
      .sendNotice({ ...notice, area: notice.area.replace(' (whole city)', '') })
      .then(() => {
        setNotice({ title: '', body: '', area: 'All areas', sms: false, app: true });
        setSent(true);
        setTimeout(() => setSent(false), 2500);
      })
      .catch(noop);
  };

  return (
    <DashShell
      role="municipality"
      allow={['municipality', 'admin']}
      title="Control tower"
      subtitle="Live view of every mapped facility: what is reported working, where the gaps are and who needs to act."
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      actions={<button type="button" className="btn btn-outline btn-sm" onClick={printPage}><Printer size={14} /> Export PDF</button>}
    >
      <div className="print-only"><h2>SanFlow &amp; WASHLink — WASH report</h2><p>Generated {new Date().toLocaleString()}</p></div>

      {tab === 'gis' && (
        <>
          <div className="dash-row">
            <Kpi label="Facilities mapped" value={facilities.length.toLocaleString()} hint={`${toilets.length.toLocaleString()} toilets`} />
            <Kpi label="Reported broken / closed" value={facilities.filter((f) => !isFunctional(f)).length} tone={facilities.some((f) => !isFunctional(f)) ? 'danger' : undefined} hint="by citizens or OpenStreetMap" />
            <Kpi label="Toilets needing attention" value={toilets.filter(needsAttention).length} hint="dirty, filling, full or broken" tone="warning" />
            <Kpi label="Open citizen reports" value={openReports.length} tone={openReports.length ? 'danger' : undefined} />
            <Kpi label="Avg. resolution time" value={resHours == null ? '—' : `${resHours.toFixed(1)} h`} />
          </div>
          <div className="dash-card">
            <div className="layer-toggle no-print">
              {[['status', 'Reported problems'], ['clean', 'Toilets needing attention'], ['coverage', 'Coverage gaps']].map(([k, label]) => (
                <button key={k} type="button" className={layer === k ? 'is-active' : ''} onClick={() => setLayer(k)}>{label}</button>
              ))}
            </div>
            {layer === 'coverage' && (
              <div className="layer-toggle no-print" style={{ marginLeft: 8 }}>
                {['Nairobi', 'Kampala'].map((c) => (
                  <button key={c} type="button" className={mapCity === c ? 'is-active' : ''} onClick={() => setMapCity(c)}>{c}</button>
                ))}
              </div>
            )}
            <DashMap markers={markers} heat={heat} geo={geoLayer} fitKey={`${layer}-${geo ? 'g' : 'n'}-${markers.length}-${mapCity}`} height={460} />
            <ul className="legend">
              {layer === 'coverage' ? (
                <>
                  <li><i style={{ background: GOOD }} />Meets 1 toilet per 1,000 people</li>
                  <li><i style={{ background: WARN }} />50–99%</li>
                  <li><i style={{ background: BAD }} />Under 50%</li>
                  <li><i style={{ background: UNKNOWN }} />Population not available</li>
                </>
              ) : (
                <>
                  <li><i style={{ background: BAD }} />Broken or closed (red glow = hotspot)</li>
                  <li><i style={{ background: WARN }} />Full, filling or dirty</li>
                </>
              )}
            </ul>
            {markers.length === 0 && layer !== 'coverage' && <p className="sub">No facility has been reported as having a problem yet. Most mapped facilities are “not yet verified” — problems appear here as citizens report them.</p>}
            <p className="sub">{ATTRIBUTION}</p>
          </div>
        </>
      )}

      {tab === 'gaps' && (
        <div className="dash-stack">
          <div className="dash-card">
            <h3>Automatic gap alerts</h3>
            <p className="sub">Standard used: {ops.wardsStandard ?? '1 public toilet per 1,000 people'}. Population is a WorldPop modelled estimate. OpenStreetMap toilet coverage is incomplete, so a low figure can mean “not yet mapped” as well as “not built” — verify before acting.</p>
            {gapAlerts.slice(0, 15).map((w) => (
              <div className="list-item" key={w.id}>
                <div><h4><TriangleAlert size={14} /> {w.name} ({w.city})</h4><p>{w.name} has about {w.population.toLocaleString()} people and {w.working} mapped public toilet{w.working === 1 ? '' : 's'} not reported broken — the standard calls for {w.required}.</p></div>
                <span className="pill pill-bad">short by {w.gap}</span>
              </div>
            ))}
            {brokenAlerts.map(({ f, days }) => (
              <div className="list-item" key={f.id}>
                <div><h4><TriangleAlert size={14} /> {f.name}</h4><p>{f.category === 'water' ? 'Water point' : 'Facility'} broken for {days} days — {f.area}.</p></div>
                <span className="pill pill-bad">{days} days</span>
              </div>
            ))}
            {wards.length === 0 && <p className="empty">No wards have been imported yet (run <code>npm run import:wards</code> on the server).</p>}
            {wards.length > 0 && !gapAlerts.length && !brokenAlerts.length && <p className="empty">No gaps detected.</p>}
          </div>
          <div className="dash-card">
            <h3>Ward coverage table</h3>
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Ward</th><th>City</th><th>Population (est.)</th><th>Mapped toilets</th><th>Not reported broken</th><th>Required</th><th>Gap</th><th>Coverage</th><th>Broken water</th></tr></thead>
                <tbody>
                  {wards.map((w) => (
                    <tr key={w.id}><td>{w.name}</td><td>{w.city}</td><td>{w.population != null ? w.population.toLocaleString() : '—'}</td><td>{w.toilets}</td><td>{w.working}</td><td>{w.required ?? '—'}</td><td>{w.gap ?? '—'}</td>
                      <td>{w.coveragePct == null ? '—' : <span className={`pill ${w.coveragePct >= 100 ? 'pill-good' : w.coveragePct >= 50 ? 'pill-warn' : 'pill-bad'}`}>{w.coveragePct}%</span>}</td><td>{w.brokenWater}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub">{ATTRIBUTION}</p>
          </div>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="dash-stack">
          <div className="dash-card">
            <h3>Facilities run by registered operators</h3>
            <p className="sub">Licence status is recorded by the municipality (unknown until set). Cleaning is compliant if cleaned within 6 hours, and “unknown” when no cleaning has been logged.</p>
            {owned.length === 0 && <p className="empty">No operator has claimed or registered a facility yet.</p>}
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Facility</th><th>Operator</th><th>Licence</th><th>Last cleaned</th><th>Rating</th><th>Open complaints</th><th>Status</th></tr></thead>
                <tbody>
                  {owned.map((f) => {
                    const op = ops.operators.find((o) => o.id === f.ownerId);
                    const mins = f.lastCleanedAt ? Math.round((Date.now() - new Date(f.lastCleanedAt)) / 60000) : null;
                    const cleanOk = mins == null ? null : mins <= 360;
                    const complaints = ops.reports.filter((r) => r.facilityId === f.id && r.status !== 'resolved').length;
                    const verdict = f.licensed === false ? 'bad' : f.licensed && cleanOk ? 'good' : cleanOk === false ? 'warn' : 'unknown';
                    return (
                      <tr key={f.id}><td>{f.name}</td><td>{op?.name ?? '—'}</td>
                        <td>
                          <span className={`pill ${f.licensed === true ? 'pill-good' : f.licensed === false ? 'pill-bad' : ''}`}>{f.licensed == null ? 'Unknown' : f.licensed ? 'Licensed' : 'Unlicensed'}</span>{' '}
                          <button type="button" className="btn btn-outline btn-xs" onClick={() => ops.updateFacility(f.id, { licensed: !f.licensed }).catch(noop)}>{f.licensed ? 'Mark unlicensed' : 'Mark licensed'}</button>
                        </td>
                        <td>{mins == null ? <span className="pill">Unknown</span> : <span className={`pill ${cleanOk ? 'pill-good' : 'pill-warn'}`}>{formatAgo(mins)}</span>}</td>
                        <td>{f.ratingsCount ? `${f.rating.toFixed(1)}★ (${f.ratingsCount})` : '—'}</td><td>{complaints}</td>
                        <td><span className={`pill ${verdict === 'good' ? 'pill-good' : verdict === 'bad' ? 'pill-bad' : verdict === 'warn' ? 'pill-warn' : ''}`}>{{ good: 'Compliant', bad: 'Action needed', warn: 'Cleaning overdue', unknown: 'Unknown' }[verdict]}</span></td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dash-card">
            <h3>Service providers</h3>
            {ops.providers.length === 0 && <p className="empty">No service provider has registered yet.</p>}
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Provider</th><th>Type</th><th>Zone</th><th>Licence</th><th>Rating</th><th>Jobs done</th></tr></thead>
                <tbody>
                  {ops.providers.map((p) => (
                    <tr key={p.id}><td>{p.name}</td><td>{p.kind}</td><td>{p.zone}</td>
                      <td>
                        <span className={`pill ${p.licensed ? 'pill-good' : ''}`}>{p.licensed ? 'Verified' : 'Not verified'}</span>{' '}
                        <button type="button" className="btn btn-outline btn-xs" onClick={() => ops.verifyLicence(p.id, !p.licensed).catch(noop)}>{p.licensed ? 'Revoke' : 'Verify licence'}</button>
                        {p.licenceNo && <div className="sub">No. {p.licenceNo}</div>}
                      </td>
                      <td>{p.rating ? `${p.rating}★` : '—'}</td><td>{doneJobs.filter((j) => j.providerId === p.id).length}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="dash-card">
          <h3>Citizen reports management</h3>
          <p className="sub">Assign each report to the right operator or service provider and track resolution time. Unconfirmed reports wait for a second citizen.</p>
          {ops.reports.length === 0 && <p className="empty">No citizen reports yet.</p>}
          <div className="table-wrap">
            <table className="dash-table">
              <thead><tr><th>Report</th><th>Where</th><th>Reporter</th><th>Age</th><th>Assigned to</th><th>Status</th><th /></tr></thead>
              <tbody>
                {ops.reports.map((r) => {
                  const f = facilities.find((x) => x.id === r.facilityId);
                  return (
                    <tr key={r.id}>
                      <td><b>{REPORT_LABEL[r.type]}</b><br /><span className="sub">{r.note}</span><ReportPhoto has={r.hasPhoto} inline={r.photo} load={() => ops.loadReportPhoto(r)} /></td>
                      <td>{f?.name ?? `GPS pin ${r.lat?.toFixed(3)}, ${r.lng?.toFixed(3)}`}</td>
                      <td>{r.userName}{!r.verified && <><br /><span className="pill pill-warn">Unconfirmed</span></>}</td>
                      <td>{ago(r.at)}</td>
                      <td>
                        {r.status === 'resolved' ? (r.assignedTo?.name ?? '—') : (
                          <select className="dash-select" value={r.assignedTo ? `${r.assignedTo.kind}:${r.assignedTo.id}` : ''} onChange={(e) => { const o = assignOptions.find((x) => x.key === e.target.value); if (o) ops.assignReport(r.id, { kind: o.kind, id: o.id, name: o.name }).catch(noop); }}>
                            <option value="">Assign…</option>
                            {assignOptions.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td><span className={`pill ${r.status === 'resolved' ? 'pill-good' : r.status === 'assigned' ? '' : 'pill-bad'}`}>{r.status}</span>{r.resolvedAt && <><br /><span className="sub">in {((new Date(r.resolvedAt) - new Date(r.at)) / 3600000).toFixed(1)} h</span></>}</td>
                      <td>{r.status !== 'resolved' && <button type="button" className="btn btn-outline btn-xs" onClick={() => ops.resolveReport(r.id).catch(noop)}>Resolve</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="dash-stack">
          <div className="dash-card no-print">
            <h3>Exportable reports</h3>
            <p className="sub">For health department meetings — CSV opens in Excel; PDF uses your browser&apos;s “Save as PDF”. Exports carry the data-source attribution.</p>
            <div className="list-item-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportFacilities}><Download size={14} /> Facilities (Excel/CSV)</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportWards} disabled={!wards.length}><Download size={14} /> Ward gaps (CSV)</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportReports} disabled={!ops.reports.length}><Download size={14} /> Citizen reports (CSV)</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={printPage}><Printer size={14} /> Full report (PDF)</button>
            </div>
          </div>
          <div className="dash-grid">
            <div className="dash-card">
              <h3>Functionality by service</h3>
              <p className="sub">“Not yet verified” means mapped in OpenStreetMap but no citizen or operator has confirmed its condition.</p>
              {['toilet', 'water', 'waste', 'health'].map((c) => {
                const list = facilities.filter((f) => f.category === c);
                return (
                  <div key={c} style={{ marginBottom: 14 }}>
                    <p className="sub" style={{ marginBottom: 4 }}>{{ toilet: 'Public toilets', water: 'Water points', waste: 'Waste points', health: 'Health services' }[c]} ({list.length.toLocaleString()})</p>
                    <StackBar segments={[
                      { label: 'Reported OK', value: list.filter((f) => ['clean', 'operational', 'open'].includes(f.status)).length, color: GOOD },
                      { label: 'Not yet verified', value: list.filter((f) => f.status === 'unverified').length, color: UNKNOWN },
                      { label: 'Needs attention', value: list.filter((f) => ['full', 'filling', 'dirty', 'seasonal'].includes(f.status)).length, color: WARN },
                      { label: 'Broken / closed', value: list.filter((f) => !isFunctional(f)).length, color: BAD },
                    ]} />
                  </div>
                );
              })}
            </div>
            <div className="dash-card">
              <h3>Usage — daily visits</h3>
              <p className="sub">Customers logged by operators across their facilities, last 7 days.</p>
              {owned.length ? <ColumnChart data={usage} /> : <p className="empty">No operator has logged visits yet.</p>}
            </div>
            <div className="dash-card">
              <h3>Cleanliness trend</h3>
              <p className="sub">“Dirty” citizen reports per day.</p>
              <ColumnChart data={trend} color={WARN} />
            </div>
            <div className="dash-card">
              <h3>Disease-risk hotspots</h3>
              <p className="sub">Score = broken water ×3 + full waste ×2 + toilet gap + toilets needing attention. Top 12 wards.</p>
              {wards.length ? (
                <BarList data={[...wards].sort((a, b) => b.risk - a.risk).slice(0, 12).map((w) => ({ label: `${w.name} · ${w.riskLevel}`, value: Number(w.risk.toFixed(1)), color: w.riskLevel === 'High' ? BAD : w.riskLevel === 'Medium' ? WARN : GOOD }))} />
              ) : <p className="empty">No wards imported yet.</p>}
            </div>
            <div className="dash-card">
              <h3>Service provider performance</h3>
              {ops.providers.length === 0 && <p className="empty">No providers yet.</p>}
              <div className="table-wrap">
                <table className="dash-table">
                  <thead><tr><th>Provider</th><th>Jobs done</th><th>Avg. turnaround</th><th>Rating</th></tr></thead>
                  <tbody>
                    {ops.providers.map((p) => {
                      const done = doneJobs.filter((j) => j.providerId === p.id);
                      const avg = done.length ? done.reduce((a, j) => a + (new Date(j.completedAt) - new Date(j.createdAt)), 0) / done.length / 3600000 : null;
                      return <tr key={p.id}><td>{p.name}</td><td>{done.length}</td><td>{avg == null ? '—' : `${avg.toFixed(0)} h`}</td><td>{p.rating ? `${p.rating}★` : '—'}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <h3 style={{ marginTop: 8 }}>Circular economy — waste to value</h3>
          <CircularPanel done={doneJobs} impact={impact} partners={ops.partners} />
          <p className="sub">{ATTRIBUTION}</p>
        </div>
      )}

      {tab === 'partners' && (
        <div className="dash-grid">
          <form className="dash-card dash-form" onSubmit={(e) => { e.preventDefault(); ops.addPartner(partner).then(() => setPartner({ name: '', product: '' })).catch(noop); }}>
            <h3>Register a treatment partner</h3>
            <p className="sub">Organisations that receive collected waste and turn it into fertilizer, biogas, briquettes, biochar or carbon credits. Providers record deliveries against them.</p>
            <label>Name<input required value={partner.name} onChange={(e) => setPartner({ ...partner, name: e.target.value })} /></label>
            <label>Product<input required value={partner.product} onChange={(e) => setPartner({ ...partner, product: e.target.value })} placeholder="e.g. Biogas, Organic fertilizer, Briquettes" /></label>
            <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }}>Add partner</button>
          </form>
          <div className="dash-card">
            <h3>Registered partners</h3>
            {ops.partners.length === 0 && <p className="empty">None yet.</p>}
            {ops.partners.map((p) => (
              <div className="list-item" key={p.id}>
                <div><h4>{p.name}</h4><p>{p.product} · {doneJobs.filter((j) => j.destination === p.id).reduce((a, j) => a + (j.volumeM3 ?? 0), 0)} m³ received</p></div>
                <button type="button" className="btn btn-outline btn-xs" onClick={() => ops.removePartner(p.id).catch(noop)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'comms' && (
        <div className="dash-grid">
          <form className="dash-card dash-form" onSubmit={send}>
            <h3>Send a bulk notice</h3>
            <p className="sub">Shown as an in-app banner to everyone. SMS is recorded but not sent until an SMS gateway (Africa&apos;s Talking) is connected on the server.</p>
            <label>Title<input required value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} /></label>
            <label>Area<select value={notice.area} onChange={(e) => setNotice({ ...notice, area: e.target.value })}><option>All areas</option>{[...new Set(wards.map((w) => w.city))].map((c) => <option key={c}>{c} (whole city)</option>)}{wards.map((w) => <option key={w.id}>{w.name}</option>)}</select></label>
            <label>Message<textarea required rows={3} value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} /></label>
            <div className="check-row">
              <label><input type="checkbox" checked={notice.app} onChange={(e) => setNotice({ ...notice, app: e.target.checked })} />App / web banner</label>
              <label title="Not sent until an SMS gateway is connected"><input type="checkbox" checked={notice.sms} onChange={(e) => setNotice({ ...notice, sms: e.target.checked })} />Record for SMS (not yet sent)</label>
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={!notice.sms && !notice.app}>Send notice</button>
            {sent && <div className="notice-box">Notice published ✓ — it now shows as a banner across the platform.</div>}
          </form>
          <div className="dash-card">
            <h3>Sent notices</h3>
            {ops.notices.length === 0 && <p className="empty">No notices sent yet.</p>}
            {ops.notices.map((n) => (
              <div className="list-item" key={n.id}>
                <div><h4>{n.title}</h4><p>{n.body}</p><p>{n.area} · {n.channel} · {n.by} · {ago(n.at)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashShell>
  );
}
