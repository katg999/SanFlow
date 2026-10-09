'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';

// Real platform counts from the API (null until loaded, or if the server is unreachable).
export default function useStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    apiFetch('/api/stats').then(setStats).catch(() => setStats(null));
  }, []);
  return stats;
}
