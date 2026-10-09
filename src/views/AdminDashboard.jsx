'use client';

import { useState } from 'react';
import { Users, ScrollText, ClipboardCheck } from 'lucide-react';
import DashShell from '../components/dash/DashShell.jsx';
import { Kpi } from '../components/dash/charts.jsx';
import { useOps } from '../context/OpsContext.jsx';
import { ROLES } from '../data/roles.js';
import { formatAgo } from '../utils/enrich.js';

const ago = (iso) => formatAgo(Math.round((Date.now() - new Date(iso).getTime()) / 60000));

// Status of every item in the "Core Functionalities & Developer Handover" PDF for the web build.
const DELIVERABLES = [
  ['Citizen — find nearby services on a map', 'Live', 'Real OpenStreetMap data: toilets, water points, waste points, health (Nairobi & Kampala metro)'],
  ['Citizen — in-site navigation to the nearest toilet', 'Live', 'OSRM walking route drawn on our map, live GPS tracking, re-routing'],
  ['Citizen — real-time info (distance, fee, last cleaned, water quality, queue)', 'Partial', 'Shown only when known: from OpenStreetMap tags, operators, or citizens. Sensors/IoT would fill queue and cleaning automatically'],
  ['Citizen — report issues with photo + GPS, rate, confirm availability', 'Live', 'With server-side anti-fake verification'],
  ['Operator portal — facility, pricing, alerts, business dashboard, discounts', 'Live', 'Claim existing facilities or register new ones'],
  ['Service provider portal — jobs, route optimisation, completion, receipts', 'Live', 'Nearest-neighbour route ordering; print/PDF receipt'],
  ['Municipality — GIS map, gap analysis, compliance, reports, assignment', 'Live', '66 of 85 Nairobi wards + 5 Kampala divisions from OSM; population = WorldPop 2020 estimates'],
  ['Municipality — bulk communication', 'Partial', 'In-app banner is live; SMS is recorded but not sent (needs Africa\'s Talking credentials)'],
  ['User management, roles, audit log', 'Live', 'Roles enforced by the API on every request'],
  ['Backend persistence (PostgreSQL + PostGIS)', 'Live', 'See docs/BACKEND.md'],
  ['Payments (M-Pesa / MTN MoMo / Airtel)', 'Planned', 'Optional in the brief; needs merchant accounts'],
  ['Mobile app, USSD, SMS channels', 'Out of web scope', 'Separate builds; they can use the same API (nearest-facility endpoint exists)'],
  ['IoT sensors & alert engine', 'Out of web scope', 'Phase 4 — hardware dependent; usage-counter endpoint is the hook'],
  ['Push notifications (FCM), email', 'Planned', 'Needs a backend notification worker'],
];
const TONE = { Live: 'pill-good', Partial: 'pill-warn', Planned: '', 'Out of web scope': '' };

export default function AdminDashboard() {
  const ops = useOps();
  const [tab, setTab] = useState('users');
  const tabs = [
    { key: 'users', label: 'Users & roles', icon: Users },
    { key: 'audit', label: 'Audit log', icon: ScrollText },
    { key: 'deliverables', label: 'Deliverables tracker', icon: ClipboardCheck },
  ];
  const count = (r) => ops.users.filter((u) => u.role === r).length;

  return (
    <DashShell
      role="admin"
      title="Super admin"
      subtitle="Manage every user, role and system setting. Admins can also open the Municipality portal."
      tabs={tabs}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'users' && (
        <>
          <div className="dash-row">
            {Object.keys(ROLES).map((r) => <Kpi key={r} label={ROLES[r].label} value={count(r)} />)}
          </div>
          <div className="dash-card">
            <h3>All users</h3>
            <div className="table-wrap">
              <table className="dash-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th></tr></thead>
                <tbody>
                  {ops.users.length === 0 && <tr><td colSpan={5}>No users.</td></tr>}
                  {ops.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td><td>{u.email}</td>
                      <td>
                        <select className="dash-select" value={u.role} onChange={(e) => ops.updateUser(u.id, { role: e.target.value }).catch(() => {})}>
                          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td>{ago(u.joined)}</td>
                      <td><button type="button" className={`btn btn-xs ${u.active ? 'btn-outline' : 'btn-danger'}`} onClick={() => ops.updateUser(u.id, { active: !u.active }).catch(() => {})}>{u.active ? 'Active — suspend' : 'Suspended — restore'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'audit' && (
        <div className="dash-card">
          <h3>Audit log</h3>
          <p className="sub">Every create / assign / update action across the portals.</p>
          {ops.audit.map((a) => (
            <div className="list-item" key={a.id}><div><h4>{a.action}</h4><p>{a.target}</p></div><p>{a.actor} · {ago(a.at)}</p></div>
          ))}
        </div>
      )}

      {tab === 'deliverables' && (
        <div className="dash-card">
          <h3>Web deliverables vs. the handover document</h3>
          <div className="table-wrap">
            <table className="dash-table">
              <thead><tr><th>Deliverable</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {DELIVERABLES.map(([d, s, n]) => <tr key={d}><td>{d}</td><td><span className={`pill ${TONE[s]}`}>{s}</span></td><td>{n}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashShell>
  );
}
