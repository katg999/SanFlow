import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const tokenOf = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

async function loadUser(token) {
  const { sub } = jwt.verify(token, process.env.JWT_SECRET);
  const { rows } = await query('SELECT id, name, email, role, org_id, active FROM users WHERE id = $1', [sub]);
  const u = rows[0];
  return u && u.active ? { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.org_id } : null;
}

// The role always comes from the database, never from the token, so a demoted or
// suspended user loses access immediately.
export async function requireAuth(req, res, next) {
  const token = tokenOf(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const user = await loadUser(token);
    if (!user) return res.status(401).json({ error: 'Invalid or suspended account' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = tokenOf(req);
  if (token) {
    try {
      req.user = (await loadUser(token)) ?? undefined;
    } catch {
      // invalid token — treat as anonymous
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Stable key for dedupe/rate rules: the user id, or the anonymous device id.
export function reporterKey(req) {
  if (req.user) return req.user.id;
  const device = String(req.headers['x-device-id'] || '').slice(0, 64);
  return `dev:${device || req.ip}`;
}
