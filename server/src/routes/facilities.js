import { Router } from 'express';
import Facility from '../models/Facility.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

const CATEGORIES = new Set(['toilet', 'waste', 'water', 'health']);

router.get('/', async (_req, res) => {
  const facilities = await Facility.find().sort({ id: 1 });
  res.json({ facilities });
});

router.post('/', requireAuth, async (req, res) => {
  const { name, category, area, country, lat, lng, hours, description } = req.body || {};

  if (!name || !category || !area || !country) {
    return res.status(400).json({ error: 'name, category, area and country are required' });
  }
  if (!CATEGORIES.has(category)) {
    return res.status(400).json({ error: `category must be one of ${[...CATEGORIES].join(', ')}` });
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  const facility = await Facility.create({
    id: `usr-${category}-${Date.now()}`,
    name: String(name).trim(),
    category,
    area: String(area).trim(),
    country: String(country).trim(),
    lat: latNum,
    lng: lngNum,
    status: 'unverified',
    rating: 0,
    ratingsCount: 0,
    hours: hours || undefined,
    description: description || undefined,
  });

  res.status(201).json({ facility });
});

router.get('/:id', async (req, res) => {
  const facility = await Facility.findOne({ id: req.params.id });
  if (!facility) return res.status(404).json({ error: 'Not found' });
  res.json({ facility });
});

router.post('/:id/rate', optionalAuth, async (req, res) => {
  const stars = Number(req.body?.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'stars must be a number between 1 and 5' });
  }

  const facility = await Facility.findOne({ id: req.params.id });
  if (!facility) return res.status(404).json({ error: 'Not found' });

  const newCount = facility.ratingsCount + 1;
  facility.rating = Number(((facility.rating * facility.ratingsCount + stars) / newCount).toFixed(2));
  facility.ratingsCount = newCount;
  await facility.save();

  res.json({ facility });
});

router.post('/:id/report', optionalAuth, async (req, res) => {
  const { status, note } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });

  const facility = await Facility.findOne({ id: req.params.id });
  if (!facility) return res.status(404).json({ error: 'Not found' });

  const at = new Date();
  facility.status = status;
  facility.reports = [{ status, note: note || '', at }, ...facility.reports].slice(0, 5);
  facility.lastReportedAt = at;
  await facility.save();

  res.json({ facility });
});

export default router;
