import mongoose from 'mongoose';

const TRANSACTION_TYPES = ['topup', 'consume', 'refund', 'adjustment'];

const creditTransactionSchema = new mongoose.Schema({
  reseller: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', required: true, index: true },
  type: { type: String, enum: TRANSACTION_TYPES, required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  relatedSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  note: { type: String, trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: { createdAt: true, updatedAt: false } });

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

export { TRANSACTION_TYPES };
export default CreditTransaction;
