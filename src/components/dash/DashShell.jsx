'use client';

import Link from 'next/link';
import { useAuth } from '../../context/AuthContext.jsx';
import { useOps } from '../../context/OpsContext.jsx';
import { ROLES } from '../../data/roles.js';
import './Dash.css';

// Role guard + page frame shared by every portal.
export default function DashShell({ role, allow, title, subtitle, tabs, tab, onTab, actions, children }) {
  const { user, hydrated, apiUp } = useAuth();
  const { ready, error, clearError } = useOps();
  const allowed = allow ?? [role];

  if (!hydrated || !ready) return <div className="dash-gate"><p>Loading…</p></div>;

  if (!apiUp) {
    return (
      <div className="dash-gate">
        <div className="dash-gate-card">
          <h1>Can&apos;t reach the SanFlow server</h1>
          <p>The portals show live data only, and none is stored in your browser. Please check your connection and reload.</p>
        </div>
      </div>
    );
  }

  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="dash-gate">
        <div className="dash-gate-card">
          <h1>{ROLES[role].label} portal</h1>
          <p>
            {user
              ? `You are signed in as ${ROLES[user.role]?.label ?? user.role}. This area is for ${allowed.map((r) => `${ROLES[r].label}s`).join(' and ')}.`
              : 'Sign in with your SanFlow account to continue.'}
          </p>
          <div className="dash-gate-actions">
            {!user && <Link href="/login" className="btn btn-primary">Sign in</Link>}
            {!user && <Link href="/register" className="btn btn-outline">Create an account</Link>}
            {user && <Link href={ROLES[user.role]?.home ?? '/map'} className="btn btn-primary">Go to my portal</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <header className="dash-head no-print">
        <div>
          <span className="eyebrow">{ROLES[user.role].label} portal</span>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="dash-head-actions">{actions}</div>
      </header>
      {error && (
        <div className="dash-error no-print" role="alert">
          {error} <button type="button" onClick={clearError}>Dismiss</button>
        </div>
      )}
      <nav className="dash-tabs no-print" role="tablist">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`dash-tab ${tab === key ? 'is-active' : ''}`} onClick={() => onTab(key)}>
            {Icon && <Icon size={15} />} {label}
            {badge > 0 && <span className="dash-badge">{badge}</span>}
          </button>
        ))}
      </nav>
      <div className="dash-body">{children}</div>
    </div>
  );
}
