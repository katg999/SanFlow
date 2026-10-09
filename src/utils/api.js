// Same origin by default: the API is served by the same server as the pages. Set NEXT_PUBLIC_API_URL only if it lives elsewhere.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const TOKEN_KEY = 'washlink_token';
const DEVICE_KEY = 'sanflow-washlink:device';

// Anonymous users are told apart by a per-browser device id, so one shared IP (office, mobile
// carrier NAT) doesn't make everyone's second report look like a duplicate.
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev-anon';
  }
}

// Earlier builds kept sample data and a fake session in this browser. Remove them once so old fake
// ratings/statuses can never be merged into real data.
if (typeof window !== 'undefined') {
  try {
    ['sanflow-washlink:ops:v1', 'sanflow-washlink:facility-overrides:v1', 'washlink_session'].forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': getDeviceId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed with ${res.status}`);
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

// True when the backend answers and its database is up. Free hosts put idle servers to sleep and the first request
// can take up to a minute while it wakes, so keep trying for ~65 s before giving up.
export async function apiHealthy({ attempts = 8, timeoutMs = 8000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
