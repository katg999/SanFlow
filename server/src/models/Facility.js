import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    image: { type: String },
    area: { type: String, required: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    status: { type: String, required: true },
    rating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    hours: { type: String },
    description: { type: String },
    reports: { type: [reportSchema], default: [] },
    lastReportedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Facility', facilitySchema);
