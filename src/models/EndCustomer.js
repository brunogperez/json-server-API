import mongoose from 'mongoose';

const endCustomerSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  reseller: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', required: true, index: true },
  active: { type: Boolean, default: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

endCustomerSchema.index({ reseller: 1, email: 1 });

const EndCustomer = mongoose.model('EndCustomer', endCustomerSchema);

export default EndCustomer;
