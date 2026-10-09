'use client';

import { useState } from 'react';

// Photos are loaded on demand (the API keeps them out of list responses — they are large).
export default function ReportPhoto({ has, inline, load, alt = 'Report evidence' }) {
  const [src, setSrc] = useState(inline ?? null);
  const [busy, setBusy] = useState(false);
  if (src) return <div className="photo-row"><img src={src} alt={alt} /></div>;
  if (!has) return null;
  return (
    <button
      type="button"
      className="btn btn-outline btn-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          setSrc(await load());
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Loading…' : 'View photo'}
    </button>
  );
}
