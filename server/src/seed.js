import 'dotenv/config';
import { connectDB } from './db.js';
import Facility from './models/Facility.js';
import { FACILITIES } from './seedData.js';
import mongoose from 'mongoose';

async function run() {
  await connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/washlink');

  for (const facility of FACILITIES) {
    await Facility.updateOne({ id: facility.id }, { $setOnInsert: facility }, { upsert: true });
  }

  console.log(`Seeded ${FACILITIES.length} facilities.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
