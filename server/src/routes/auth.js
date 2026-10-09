import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, bad, rateLimit } from '../lib/http.js';
import { audit } from '../lib/audit.js';

const router = Router();
// Self-service sign-up may only pick a public role; municipality/admin are granted by a super admin.
const SELF_SERVICE_ROLES = ['citizen', 'operator', 'provider'];
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

const signToken = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const toPublicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.org_id ?? undefined });

router.post('/register', limiter, wrap(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) throw bad('name, email and password are required');
  if (String(password).length < 8) throw bad('password must be at least 8 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw bad('invalid email');

  const normalizedEmail = String(email).trim().toLowerCase();
  const safeRole = SELF_SERVICE_ROLES.includes(role) ? role : 'citizen';

  const user = await tx(async (c) => {
    const exists = await c.query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (exists.rowCount) return null;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await c.query(
      'INSERT INTO users(name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [String(name).trim(), normalizedEmail, hash, safeRole]
    );
    let u = rows[0];
    if (safeRole === 'operator' || safeRole === 'provider') {
      await c.query('INSERT INTO organisations(id, kind, name, provider_kind) VALUES ($1, $2, $3, $4)', [
        u.id, safeRole, u.name, safeRole === 'provider' ? 'Sewage exhauster' : null,
      ]);
      u = (await c.query('UPDATE users SET org_id = id::text WHERE id = $1 RETURNING *', [u.id])).rows[0];
    }
    await audit(c, u, 'Registered account', safeRole);
    return u;
  });
  if (!user) return res.status(409).json({ error: 'emailTaken' });
  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw bad('email and password are required');
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = $1', [String(email).trim().toLowerCase()]);
  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) return res.status(401).json({ error: 'invalidCredentials' });
  if (!user.active) return res.status(403).json({ error: 'accountSuspended' });
  res.json({ token: signToken(user), user: toPublicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
