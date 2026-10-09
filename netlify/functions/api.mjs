// The SanFlow API as a Netlify Function: the same Express app that `npm start` serves, so the pages and the API live on
// one site and one origin (/api/* is rewritten here by netlify.toml). Schema migrations and data imports are run from a
// developer machine (`npm run migrate` / `npm run import`), never from a function.
import express from 'express';
import serverless from 'serverless-http';
import { mountApi } from '../../server/src/app.js';

const app = express();
app.set('trust proxy', 1);
mountApi(app);

const run = serverless(app);
const PREFIX = '/.netlify/functions/api';

export const handler = (event, context) => {
  // The redirect delivers /.netlify/functions/api/<route>; the Express app expects /api/<route>.
  if (event.path.startsWith(PREFIX)) event.path = `/api${event.path.slice(PREFIX.length)}`;
  else if (!event.path.startsWith('/api')) event.path = `/api${event.path}`;
  return run(event, context);
};
