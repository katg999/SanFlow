'use client';

// One facility source for the map, chatbot and dashboards. Status only ever comes from the server: after a
// report or confirmation we re-fetch, the browser never sets a public status itself.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFacilityStore } from './useFacilityStore.js';
import { useOps } from '../context/OpsContext.jsx';
import { enrichFacility } from '../utils/enrich.js';

export function useFacilities() {
  const ops = useOps();
  const store = useFacilityStore();
  const { reload } = store;

  // Something changed on the server (report, confirmation, operator edit…) — pull fresh facilities.
  const lastVersion = useRef(ops.version);
  useEffect(() => {
    if (ops.version !== lastVersion.current) {
      lastVersion.current = ops.version;
      reload(true); // bypass the CDN cache: show the user's own change immediately
    }
  }, [ops.version, reload]);

  const facilities = useMemo(() => store.facilities.map(enrichFacility), [store.facilities]);

  const submitReport = useCallback((payload) => ops.submitReport(payload), [ops]);

  const confirmAvailability = useCallback(
    async (facility, working) => {
      await ops.confirmAvailability(facility, working);
      if (!working) await ops.submitReport({ facility, type: 'broken', note: 'Reported not working today', gps: null });
    },
    [ops]
  );

  return { ...store, facilities, submitReport, confirmAvailability };
}
