'use client';

// Facilities come only from the API (OpenStreetMap-imported + registered by operators). There is no local
// fallback data: if the server is unreachable `error` is set and the list is empty.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api.js';

export function useFacilityStore() {
  const [facilities, setFacilities] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [myRatings, setMyRatings] = useState({});

  // Re-read after anything that changes server state (verified report, confirmation, operator edit).
  const reload = useCallback(
    (fresh = false) =>
      apiFetch(fresh ? `/api/facilities?t=${Date.now()}` : '/api/facilities')
        .then(({ facilities: list }) => {
          setFacilities(list);
          setStatus('ready');
        })
        .catch(() => setStatus((s) => (s === 'ready' ? s : 'error'))),
    []
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const withMine = useMemo(() => facilities.map((f) => (myRatings[f.id] ? { ...f, userRating: myRatings[f.id] } : f)), [facilities, myRatings]);

  const addFacility = useCallback(
    async (input) => {
      const { facility } = await apiFetch('/api/facilities', { method: 'POST', body: JSON.stringify(input) });
      await reload(true);
      return facility;
    },
    [reload]
  );

  const rateFacility = useCallback(async (id, stars) => {
    const { facility } = await apiFetch(`/api/facilities/${id}/rate`, { method: 'POST', body: JSON.stringify({ stars }) });
    setFacilities((prev) => prev.map((f) => (f.id === id ? { ...f, rating: facility.rating, ratingsCount: facility.ratingsCount } : f)));
    setMyRatings((prev) => ({ ...prev, [id]: stars }));
  }, []);

  return { facilities: withMine, status, rateFacility, addFacility, reload };
}
