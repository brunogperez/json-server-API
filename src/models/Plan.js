import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true },
  serviceType: { type: String, required: true, trim: true, index: true },
  durationDays: { type: Number, required: true, min: 1 },
  capacity: { type: Number, min: 1, default: 1 },
  creditCost: { type: Number, required: true, min: 0 },
  ownerPrice: { type: Number, required: true, min: 0 },
  suggestedResellerPrice: { type: Number, required: true, min: 0 },
  credentialFields: { type: [String], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
