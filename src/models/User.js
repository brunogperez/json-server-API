import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'reseller'],
    default: 'user'
  },
  // Multi-tenancy (Story 19): vincula un usuario role='reseller' con su Reseller.
  resellerProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reseller',
    index: true
  },
  // Lockout tras N intentos fallidos de login (Story 18)
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // Se incrementa para invalidar todos los tokens emitidos (logout-all,
  // reseteo de contraseña, reuso de refresh token).
  tokenVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_TIME_MS = parseInt(process.env.ACCOUNT_LOCK_TIME_MS) || 15 * 60 * 1000;

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Método para verificar password
userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// ── Lockout de cuenta ────────────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Registra un intento fallido; bloquea la cuenta si supera el máximo.
userSchema.methods.registerFailedLogin = async function () {
  // Si el lock previo expiró, reseteamos el contador antes de sumar.
  if (this.lockUntil && this.lockUntil.getTime() <= Date.now()) {
    this.failedLoginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.failedLoginAttempts += 1;
  }
  if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
  }
  await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
  if (this.failedLoginAttempts === 0 && !this.lockUntil) return;
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    return ret;
  }
});

const User = mongoose.model('User', userSchema);
export { MAX_LOGIN_ATTEMPTS, LOCK_TIME_MS };

export default User;