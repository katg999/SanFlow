'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useOps } from '../context/OpsContext.jsx';
import './NoticeBanner.css';

const DISMISS_KEY = 'sanflow-washlink:dismissed-notice';

// Municipality bulk notices (D.6) surface to every user as a site-wide banner.
export default function NoticeBanner() {
  const { ready, notices } = useOps();
  const [dismissed, setDismissed] = useState(null);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) ?? '');
    } catch {
      setDismissed('');
    }
  }, []);
  const latest = notices[0];
  if (!ready || dismissed === null || !latest || latest.id === dismissed) return null;
  if (Date.now() - new Date(latest.at).getTime() > 3 * 86400000) return null;

  return (
    <div className="notice-banner" role="status">
      <Megaphone size={16} />
      <span><b>{latest.title}</b> — {latest.body} <em>({latest.area})</em></span>
      <button type="button" aria-label="Dismiss notice" onClick={() => { setDismissed(latest.id); try { localStorage.setItem(DISMISS_KEY, latest.id); } catch {} }}><X size={15} /></button>
    </div>
  );
}
