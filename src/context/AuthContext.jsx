import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// No backend yet: accounts and sessions are stubbed in localStorage so the
// login/register flow is usable now and can be swapped for a real API by
// replacing the three functions below.
const USERS_KEY = 'washlink_users';
const SESSION_KEY = 'washlink_session';

const AuthContext = createContext(null);

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage failures
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore storage failures
    }
  }, [user]);

  const register = useCallback((name, email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = loadUsers();
    if (users.some((u) => u.email === normalizedEmail)) {
      return { ok: false, error: 'emailTaken' };
    }
    const newUser = { name: name.trim(), email: normalizedEmail, password };
    saveUsers([...users, newUser]);
    setUser({ name: newUser.name, email: newUser.email });
    return { ok: true };
  }, []);

  const login = useCallback((email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = loadUsers();
    const match = users.find((u) => u.email === normalizedEmail && u.password === password);
    if (!match) return { ok: false, error: 'invalidCredentials' };
    setUser({ name: match.name, email: match.email });
    return { ok: true };
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, register, login, logout }), [user, register, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
