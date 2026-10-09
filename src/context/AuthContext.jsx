'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiHealthy, getToken, setToken } from '../utils/api.js';

const AuthContext = createContext(null);

// Real accounts only: sessions are server-issued JWTs. If the API is unreachable `apiUp` is false and the
// app shows an error state — there is no offline/sample mode.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [apiUp, setApiUp] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      const up = await apiHealthy();
      setApiUp(up);
      if (up && getToken()) {
        try {
          const { user: me } = await apiFetch('/api/auth/me');
          setUser(me);
        } catch (err) {
          if (err.status === 401) setToken(null); // expired or suspended
        }
      }
      setHydrated(true);
    }
    restoreSession();
  }, []);

  const register = useCallback(async (name, email, password, role = 'citizen') => {
    try {
      const { token, user: newUser } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      setToken(token);
      setUser(newUser);
      return { ok: true, user: newUser };
    } catch (err) {
      return { ok: false, error: err.code || 'networkError' };
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { token, user: loggedInUser } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(token);
      setUser(loggedInUser);
      return { ok: true, user: loggedInUser };
    } catch (err) {
      return { ok: false, error: err.code || 'networkError' };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, hydrated, apiUp, register, login, logout }),
    [user, hydrated, apiUp, register, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
