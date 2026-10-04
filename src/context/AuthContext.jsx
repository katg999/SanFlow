'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getToken, setToken } from '../utils/api.js';

const SESSION_KEY = 'washlink_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (token) {
        try {
          const { user: me } = await apiFetch('/api/auth/me');
          setUser(me);
        } catch {
          setToken(null);
        }
      }
      setHydrated(true);
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore storage failures
    }
  }, [user, hydrated]);

  const register = useCallback(async (name, email, password) => {
    try {
      const { token, user: newUser } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setToken(token);
      setUser(newUser);
      return { ok: true };
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
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.code || 'networkError' };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, register, login, logout }), [user, register, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
