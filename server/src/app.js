import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { query } from './db.js';
import authRoutes from './routes/auth.js';
import facilitiesRoutes from './routes/facilities.js';
import reportsRoutes from './routes/reports.js';
import jobsRoutes from './routes/jobs.js';
import { notices, users, directory, analytics, auditRoutes, publicStats } from './routes/admin.js';

// Registers the JSON API (everything under /api) on an Express app. Security headers, CORS and the JSON body parser
// apply to /api only, so the same app can also serve the Next.js pages (see /server.mjs).
export function mountApi(app) {
  // When the pages are hosted on another origin (CORS_ORIGIN set), the browser must be allowed to read our responses.
  app.use('/api', helmet(process.env.CORS_ORIGIN ? { crossOriginResourcePolicy: { policy: 'cross-origin' } } : undefined));
  // Same-origin by default (the web app and API are one server). Set CORS_ORIGIN only if the web app is hosted elsewhere.
  if (process.env.CORS_ORIGIN) {
    app.use('/api', cors({ origin: process.env.CORS_ORIGIN.split(','), allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'] }));
  }
  // photos arrive as small base64 data URLs (see docs/BACKEND.md: move to object storage at scale)
  app.use('/api', express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/facilities', facilitiesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/notices', notices);
  app.use('/api/users', users);
  app.use('/api/directory', directory);
  app.use('/api/analytics', analytics);
  app.use('/api/audit', auditRoutes);
  app.use('/api/stats', publicStats);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use('/api', (err, req, res, next) => {
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

// API-only app (used by the tests).
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(compression());
  return mountApi(app);
}
