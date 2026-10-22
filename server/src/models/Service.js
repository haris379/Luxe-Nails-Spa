import mongoose from 'mongoose';
import { CATEGORY_IDS } from '../utils/categories.js';

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    price: { type: Number, required: true, min: 0 },
    isStartingPrice: { type: Boolean, default: false },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    image: { type: String, default: '' },
    category: { type: String, enum: CATEGORY_IDS, default: 'nail-services', index: true },
    slug: { type: String, trim: true, unique: true, sparse: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Service = mongoose.model('Service', serviceSchema);
