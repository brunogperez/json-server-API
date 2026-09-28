import mongoose from 'mongoose';

const resellerSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  businessName: { type: String, trim: true },
  credits: { type: Number, default: 0, min: 0 },
  isOwner: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

resellerSchema.index({ isOwner: 1 }, { unique: true, partialFilterExpression: { isOwner: true } });

const Reseller = mongoose.model('Reseller', resellerSchema);

export default Reseller;
