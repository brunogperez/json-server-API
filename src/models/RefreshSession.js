import mongoose from 'mongoose';

// Una sesión por refresh token emitido. Permite rotarlos, revocarlos y detectar
// reuso (un token ya rotado que vuelve a presentarse indica robo).
const refreshSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  jti: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  // Sólo un token 'rotated' que vuelve a presentarse indica robo; uno cerrado
  // por logout simplemente es inválido.
  revokedReason: {
    type: String,
    enum: ['rotated', 'logout', 'revoke-all', null],
    default: null
  }
}, {
  timestamps: true
});

// TTL: Mongo borra la sesión cuando vence el refresh token.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshSession', refreshSessionSchema);
