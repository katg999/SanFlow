import { useCallback, useEffect, useState } from 'react';
import { FACILITIES } from '../data/facilities.js';

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

export function useFacilityStore() {
  const [overrides, setOverrides] = useState(loadOverrides);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const facilities = FACILITIES.map((f) => mergeFacility(f, overrides[f.id]));

  const rateFacility = useCallback((id, stars) => {
    setOverrides((prev) => {
      const base = FACILITIES.find((f) => f.id === id);
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
  }, []);

  const reportIssue = useCallback((id, status, note) => {
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
  }, []);

  return { facilities, rateFacility, reportIssue };
}
