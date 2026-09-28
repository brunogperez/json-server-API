import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

const SUBSCRIPTION_STATUSES = ['active', 'expired', 'cancelled', 'suspended'];

const subscriptionSchema = new mongoose.Schema({
  endCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'EndCustomer', required: true, index: true },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },

  planSnapshot: {
    name: String,
    serviceType: String,
    durationDays: Number,
    capacity: Number,
    creditCost: Number
  },

  salePrice: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true, default: Date.now },
  endDate: { type: Date, required: true, index: true },

  status: {
    type: String,
    enum: SUBSCRIPTION_STATUSES,
    default: 'active',
    index: true
  },

  credentials: { type: Map, of: String, default: {} },

  notes: { type: String, trim: true }
}, { timestamps: true });

subscriptionSchema.virtual('daysRemaining').get(function () {
  if (!this.endDate) return 0;
  const diff = this.endDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// ── Cifrado en reposo de credenciales (Story 18) ──────────────────────
// pre('save'): cifra los valores antes de persistir. encrypt() es idempotente
// (no re-cifra valores ya cifrados).
subscriptionSchema.pre('save', function (next) {
  if (this.credentials && this.isModified('credentials')) {
    for (const [k, v] of this.credentials) {
      if (typeof v === 'string') this.credentials.set(k, encrypt(v));
    }
  }
  next();
});

// post('init'): descifra al cargar desde la DB para que rutas y respuestas
// vean texto plano. decrypt() es idempotente sobre texto plano.
subscriptionSchema.post('init', function () {
  if (this.credentials) {
    for (const [k, v] of this.credentials) {
      if (typeof v === 'string') this.credentials.set(k, decrypt(v));
    }
    this.unmarkModified('credentials');
  }
});

subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export { SUBSCRIPTION_STATUSES };
export default Subscription;
