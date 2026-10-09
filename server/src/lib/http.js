// Express 4 does not catch rejected promises — wrap async handlers.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg) => new HttpError(400, msg);

export function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw bad(`${name} must be one of ${allowed.join(', ')}`);
  return value;
}

export function num(value, name, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${name} must be a number between ${min} and ${max}`);
  return n;
}

// Tiny in-memory sliding-window limiter (per IP). Use Redis/edge limits when scaled out.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many requests, slow down' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}
