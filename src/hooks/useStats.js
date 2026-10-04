import { FACILITIES, CATEGORIES } from '../data/facilities.js';

export default function useStats() {
  const total = FACILITIES.length;
  const byCategory = Object.keys(CATEGORIES).reduce((acc, key) => {
    acc[key] = FACILITIES.filter((f) => f.category === key).length;
    return acc;
  }, {});
  const countries = new Set(FACILITIES.map((f) => f.country)).size;
  const avgRating = FACILITIES.reduce((sum, f) => sum + f.rating, 0) / FACILITIES.length;

  return { total, byCategory, countries, avgRating };
}
