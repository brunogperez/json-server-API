import mongoose from 'mongoose';

/**
 * Registro de auditoría de acciones sensibles sobre usuarios (Story 18).
 * Inmutable por convención: solo se inserta, nunca se modifica.
 */
const AUDIT_ACTIONS = [
  'user.login.success',
  'user.login.failed',
  'user.login.locked',
  'user.create',
  'user.update',
  'user.delete',
];

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String },
    ip: { type: String },
    // Cambios o metadata libre (no incluir secretos).
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export { AUDIT_ACTIONS };
export default AuditLog;
