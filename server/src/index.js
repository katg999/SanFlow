import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import facilitiesRoutes from './routes/facilities.js';

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(',') }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilitiesRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/washlink')
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
