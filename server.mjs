// One server: the Next.js web app and the JSON API (/api/*) run in a single Node process on a single port
// (`npm run dev` / `npm start`). With API_ONLY=true it serves only the API, for when the pages live on Netlify.
import express from 'express';
import compression from 'compression';
import next from 'next';
import nextEnv from '@next/env';

const dev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
nextEnv.loadEnvConfig(process.cwd(), dev);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.error('JWT_SECRET must be set (24+ random characters) in .env.local or the environment.');
  process.exit(1);
}

// Imported after the env is loaded: the database pool reads DATABASE_URL at import time.
const { mountApi } = await import('./server/src/app.js');
const { migrate } = await import('./server/src/migrate.js');

await migrate();

const port = Number(process.env.PORT) || 3000;
const app = express();
app.set('trust proxy', 1);
app.use(compression());
mountApi(app);

// API_ONLY=true: serve just /api (the web pages are hosted elsewhere, e.g. Netlify). Saves memory on small hosts.
const apiOnly = process.env.API_ONLY === 'true';
if (apiOnly) {
  app.get('/', (_req, res) => res.json({ service: 'sanflow-washlink-api', health: '/api/health' }));
} else {
  const nextApp = next({ dev, hostname: '0.0.0.0', port });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  app.all('*', (req, res) => handle(req, res));
}

app.listen(port, () => console.log(`SanFlow ready on http://localhost:${port} (${dev ? 'development' : 'production'}) — ${apiOnly ? 'API only' : 'web app + API'}`));
