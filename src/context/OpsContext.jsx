'use client';

// Shared state for citizen reports and the operator / provider / municipality / admin portals.
// Everything is read from and written to the backend API (PostgreSQL + PostGIS); roles are enforced there.
// There is no sample data and no offline mode: if the server is unreachable `apiUp` is false and the pages
// show an error instead of numbers.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';

const EMPTY = { reports: [], jobs: [], notices: [], users: [], audit: [] };
const EMPTY_REMOTE = { providers: [], partners: [], operators: [], wards: null, wardsStandard: null, myFacilities: [] };
const OpsContext = createContext(null);

const post = (body) => ({ method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = (body) => ({ method: 'PATCH', body: JSON.stringify(body ?? {}) });

export function OpsProvider({ children }) {
  const { user, hydrated, apiUp } = useAuth();
  const [state, setState] = useState(EMPTY);
  const [remote, setRemote] = useState(EMPTY_REMOTE);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);
  const role = user?.role;

  const refresh = useCallback(async () => {
    if (!apiUp) return;
    const staff = ['municipality', 'admin'].includes(role);
    const wants = {
      notices: '/api/notices',
      reports: user && '/api/reports',
      jobs: ['provider', 'operator', 'municipality', 'admin'].includes(role) && '/api/jobs',
      users: role === 'admin' && '/api/users',
      audit: role === 'admin' && '/api/audit',
      providers: user && '/api/directory/providers',
      partners: user && '/api/directory/partners',
      operators: staff && '/api/directory/operators',
      wards: staff && '/api/analytics/wards',
      facilities: ['operator', 'municipality', 'admin'].includes(role) && '/api/facilities/mine',
    };
    const entries = Object.entries(wants).filter(([, path]) => path);
    const results = await Promise.allSettled(entries.map(([, path]) => apiFetch(path)));
    const data = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled') Object.assign(data, r.value);
    });
    setState({
      notices: data.notices ?? [],
      reports: data.reports ?? [],
      jobs: data.jobs ?? [],
      users: data.users ?? [],
      audit: data.audit ?? [],
    });
    setRemote({
      providers: data.providers ?? [],
      partners: data.partners ?? [],
      operators: data.operators ?? [],
      wards: data.wards ?? null,
      wardsStandard: data.standard ?? null,
      myFacilities: data.facilities ?? [],
    });
    setLoaded(true);
  }, [apiUp, user, role]);

  // Keyed on the user so a login/logout never leaves the previous person's data on screen.
  useEffect(() => {
    if (!hydrated) return;
    setState(EMPTY);
    setRemote(EMPTY_REMOTE);
    setLoaded(false);
    if (apiUp) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, apiUp, user?.id]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Run an action, refresh afterwards, and surface failures instead of swallowing them.
  const act = useCallback(
    async (fn) => {
      setError(null);
      try {
        const out = await fn();
        await refresh();
        bump();
        return out;
      } catch (err) {
        setError(err.message || 'Request failed');
        throw err;
      }
    },
    [refresh, bump]
  );

  // ---- Citizens ------------------------------------------------------------------------------
  const submitReport = useCallback(
    async ({ facility, type, note, photo, gps }) => {
      try {
        const out = await apiFetch('/api/reports', post({ facilityId: facility?.id, type, note, photo, lat: gps?.lat, lng: gps?.lng }));
        if (user) refresh();
        bump();
        return out;
      } catch (err) {
        return { ok: false, code: 'error', message: err.status === 429 ? 'Too many reports — please try again later.' : err.message };
      }
    },
    [user, refresh, bump]
  );

  const confirmAvailability = useCallback(
    async (facility, working) => {
      const out = await apiFetch(`/api/facilities/${facility.id}/confirm`, post({ working }));
      bump();
      return out;
    },
    [bump]
  );

  // ---- Operators -----------------------------------------------------------------------------
  const updateFacility = useCallback(
    (id, fields) => {
      const allowed = ['fee', 'hours', 'amenities', 'discount', 'photos', 'licensed'];
      const body = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      return act(() => apiFetch(`/api/facilities/${id}`, patch(body)));
    },
    [act]
  );
  const addVisits = useCallback((id, visits = 1) => act(() => apiFetch(`/api/facilities/${id}/usage`, post({ visits }))), [act]);
  const markCleaned = useCallback((id) => act(() => apiFetch(`/api/facilities/${id}/cleaned`, post())), [act]);
  const claimFacility = useCallback((id) => act(() => apiFetch(`/api/facilities/${id}/claim`, post())), [act]);
  const releaseFacility = useCallback((id) => act(() => apiFetch(`/api/facilities/${id}/release`, post())), [act]);
  const requestPickup = useCallback((facility) => act(() => apiFetch('/api/jobs/pickup', post({ facilityId: facility.id }))), [act]);

  const registerFacility = useCallback(
    async (input) => {
      const { facility } = await act(() =>
        apiFetch('/api/facilities', post({ name: input.name, category: input.category, area: input.area, country: input.country, lat: input.lat, lng: input.lng, hours: input.hours, description: input.description, fee: input.fee, amenities: input.amenities }))
      );
      if (input.photo) await act(() => apiFetch(`/api/facilities/${facility.id}`, patch({ photos: [input.photo] })));
      return facility;
    },
    [act]
  );

  // ---- Providers -----------------------------------------------------------------------------
  const acceptJob = useCallback((jobId) => act(() => apiFetch(`/api/jobs/${jobId}/accept`, post())), [act]);
  // Returns the completed job (with the real receipt number) so the receipt can be shown.
  const completeJob = useCallback(
    async (jobId, data) => {
      const { job } = await act(() =>
        apiFetch(`/api/jobs/${jobId}/complete`, post({ before: data.before, after: data.after, volumeM3: data.volumeM3, amountKES: data.amountKES, destination: data.destination }))
      );
      return { ...job, before: data.before, after: data.after };
    },
    [act]
  );

  // ---- Municipality / admin -------------------------------------------------------------------
  const assignReport = useCallback((reportId, target) => act(() => apiFetch(`/api/reports/${reportId}/assign`, post({ kind: target.kind, id: target.id }))), [act]);
  const resolveReport = useCallback((reportId) => act(() => apiFetch(`/api/reports/${reportId}/resolve`, post())), [act]);
  const sendNotice = useCallback((n) => act(() => apiFetch('/api/notices', post({ title: n.title, body: n.body, area: n.area, sms: n.sms, app: n.app }))), [act]);
  const updateUser = useCallback((id, fields) => act(() => apiFetch(`/api/users/${id}`, patch(fields))), [act]);
  const addPartner = useCallback((p) => act(() => apiFetch('/api/directory/partners', post(p))), [act]);
  const verifyLicence = useCallback((orgId, licensed) => act(() => apiFetch(`/api/directory/organisations/${orgId}/licence`, patch({ licensed }))), [act]);
  const updateProfile = useCallback((fields) => act(() => apiFetch('/api/directory/me', patch(fields))), [act]);
  const removePartner = useCallback((id) => act(() => apiFetch(`/api/directory/partners/${id}`, { method: 'DELETE' })), [act]);

  // Large photos are not in list responses — load them when someone opens one.
  const loadReportPhoto = useCallback(async (report) => (await apiFetch(`/api/reports/${report.id}/photo`)).photo, []);
  const loadJobPhotos = useCallback((job) => apiFetch(`/api/jobs/${job.id}/photos`), []);

  const value = useMemo(
    () => ({
      ready: hydrated && (loaded || !apiUp), apiUp, error, version, clearError: () => setError(null),
      ...state,
      providers: remote.providers, partners: remote.partners, operators: remote.operators,
      wardStats: remote.wards, wardsStandard: remote.wardsStandard, myFacilities: remote.myFacilities,
      refresh, submitReport, confirmAvailability, updateFacility, addVisits, markCleaned, claimFacility, releaseFacility,
      requestPickup, registerFacility, acceptJob, completeJob, assignReport, resolveReport, sendNotice, updateUser,
      addPartner, removePartner, updateProfile, verifyLicence, loadReportPhoto, loadJobPhotos,
    }),
    [hydrated, loaded, apiUp, error, version, state, remote, refresh, submitReport, confirmAvailability, updateFacility, addVisits, markCleaned, claimFacility, releaseFacility, requestPickup, registerFacility, acceptJob, completeJob, assignReport, resolveReport, sendNotice, updateUser, addPartner, removePartner, updateProfile, verifyLicence, loadReportPhoto, loadJobPhotos]
  );
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps must be used within an OpsProvider');
  return ctx;
}
