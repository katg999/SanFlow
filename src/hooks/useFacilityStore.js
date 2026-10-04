'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FACILITIES } from '../data/facilities.js';
import { apiFetch } from '../utils/api.js';

const STORAGE_KEY = 'sanflow-washlink:facility-overrides:v1';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable (private browsing, etc.) — fail silently, session-only state still works.
  }
}

function mergeFacility(base, override) {
  if (!override) return base;
  const ratingsCount = override.ratingsCount ?? base.ratingsCount;
  const rating = override.rating ?? base.rating;
  return {
    ...base,
    status: override.status ?? base.status,
    rating,
    ratingsCount,
    userRating: override.userRating,
    reports: override.reports ?? [],
    lastReportedAt: override.lastReportedAt,
  };
}

function fromApiFacility(f) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    image: f.image,
    area: f.area,
    country: f.country,
    lat: f.lat,
    lng: f.lng,
    status: f.status,
    rating: f.rating,
    ratingsCount: f.ratingsCount,
    hours: f.hours,
    description: f.description,
    reports: f.reports ?? [],
    lastReportedAt: f.lastReportedAt,
  };
}

// `extraFacilities` lets callers blend in facilities from a live source (e.g.
// OpenStreetMap toilets/waste points) alongside the API-backed baseline —
// ratings and reports work the same way for both, keyed by facility id.
export function useFacilityStore(extraFacilities = []) {
  const [baseFacilities, setBaseFacilities] = useState(FACILITIES);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverrides(loadOverrides());
    setHydrated(true);

    apiFetch('/api/facilities')
      .then(({ facilities }) => {
        if (facilities?.length) {
          setBaseFacilities(facilities.map(fromApiFacility));
          setApiAvailable(true);
        }
      })
      .catch(() => {
        // API unreachable — fall back to the local mock baseline + localStorage overrides.
      });
  }, []);

  useEffect(() => {
    if (hydrated) saveOverrides(overrides);
  }, [overrides, hydrated]);

  const allFacilities = useMemo(
    () => [...baseFacilities, ...extraFacilities],
    [baseFacilities, extraFacilities]
  );

  const isApiBacked = useCallback(
    (id) => apiAvailable && baseFacilities.some((f) => f.id === id),
    [apiAvailable, baseFacilities]
  );

  const facilities = allFacilities.map((f) =>
    isApiBacked(f.id) ? { ...f, userRating: overrides[f.id]?.userRating } : mergeFacility(f, overrides[f.id])
  );

  const applyOverride = useCallback((id, patch) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const addFacility = useCallback(async (input) => {
    const { facility } = await apiFetch('/api/facilities', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const newFacility = fromApiFacility(facility);
    setBaseFacilities((prev) => [...prev, newFacility]);
    setApiAvailable(true);
    return newFacility;
  }, []);

  const rateFacility = useCallback(
    async (id, stars) => {
      if (isApiBacked(id)) {
        try {
          const { facility } = await apiFetch(`/api/facilities/${id}/rate`, {
            method: 'POST',
            body: JSON.stringify({ stars }),
          });
          setBaseFacilities((prev) => prev.map((f) => (f.id === id ? fromApiFacility(facility) : f)));
          applyOverride(id, { userRating: stars });
          return;
        } catch {
          // fall through to local override on failure
        }
      }

      setOverrides((prev) => {
        const base = allFacilities.find((f) => f.id === id);
        if (!base) return prev;
        const current = prev[id] ?? {};
        const priorCount = current.ratingsCount ?? base.ratingsCount;
        const priorRating = current.rating ?? base.rating;
        // Weighted-average the new rating into the running total.
        const newCount = priorCount + 1;
        const newRating = (priorRating * priorCount + stars) / newCount;

        return {
          ...prev,
          [id]: {
            ...current,
            rating: Number(newRating.toFixed(2)),
            ratingsCount: newCount,
            userRating: stars,
          },
        };
      });
    },
    [allFacilities, isApiBacked, applyOverride]
  );

  const reportIssue = useCallback(
    async (id, status, note) => {
      if (isApiBacked(id)) {
        try {
          const { facility } = await apiFetch(`/api/facilities/${id}/report`, {
            method: 'POST',
            body: JSON.stringify({ status, note }),
          });
          setBaseFacilities((prev) => prev.map((f) => (f.id === id ? fromApiFacility(facility) : f)));
          return;
        } catch {
          // fall through to local override on failure
        }
      }

      setOverrides((prev) => {
        const current = prev[id] ?? {};
        const reports = [
          { status, note: note || '', at: new Date().toISOString() },
          ...(current.reports ?? []),
        ].slice(0, 5);

        return {
          ...prev,
          [id]: {
            ...current,
            status,
            reports,
            lastReportedAt: reports[0].at,
          },
        };
      });
    },
    [isApiBacked]
  );

  return { facilities, rateFacility, reportIssue, addFacility };
}
