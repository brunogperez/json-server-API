import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import RefreshSession from '../models/RefreshSession.js';
import { authenticateToken, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.js';
import { validateCreateUser, validateLogin } from '../validators/userValidators.js';
import { apiLogger } from '../middleware/logger.js';

// Auditoría best-effort: nunca rompe el flujo principal si falla el insert.
const audit = async (action, { req, targetUser, email, details } = {}) => {
  try {
    await AuditLog.create({
      action,
      targetUser,
      email,
      performedBy: req?.user?._id,
      ip: req?.ip,
      details
    });
  } catch (err) {
    apiLogger?.warn('No se pudo registrar auditoría', { action, error: err.message });
  }
};

const handleError = (res, error, context = 'Error en el servidor') => {
  apiLogger?.error(context, { error: error.message, stack: error.stack });
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Campos que cada rol puede modificar vía PUT/PATCH. Todo lo demás (password,
// failedLoginAttempts, lockUntil, etc.) se descarta para evitar asignación masiva.
const SELF_EDITABLE_FIELDS = ['firstName', 'lastName', 'email'];
const ADMIN_EDITABLE_FIELDS = [...SELF_EDITABLE_FIELDS, 'role', 'resellerProfile'];

const pickAllowedUpdates = (body, isAdmin) => {
  const allowed = isAdmin ? ADMIN_EDITABLE_FIELDS : SELF_EDITABLE_FIELDS;
  return Object.fromEntries(
    Object.entries(body || {}).filter(([key]) => allowed.includes(key))
  );
};

const buildUserResponse = (user) => ({
  _id: user._id,
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  resellerProfile: user.resellerProfile,
  createdAt: user.createdAt
});

const signToken = (user) => jwt.sign(
  {
    userId: user._id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    tv: user.tokenVersion ?? 0
  },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// Refresh token: vida larga, secreto propio. En desarrollo cae a JWT_SECRET+sufijo
// si no se define uno dedicado; en producción config/env.js exige ambos secretos.
// Sólo lleva el userId y un claim type='refresh'.
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || `${process.env.JWT_SECRET}:refresh`;
const RESET_SECRET = process.env.PASSWORD_RESET_SECRET || `${process.env.JWT_SECRET}:reset`;

// Emite un refresh token y registra su sesión (jti) para poder rotarlo/revocarlo.
const issueRefreshToken = async (user) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { userId: user._id, type: 'refresh', tv: user.tokenVersion ?? 0 },
    REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d', jwtid: jti }
  );
  const { exp } = jwt.decode(token);
  await RefreshSession.create({ user: user._id, jti, expiresAt: new Date(exp * 1000) });
  return token;
};

// Invalida todos los tokens del usuario: sube tokenVersion y revoca sus sesiones.
const revokeAllSessions = async (userId) => {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  await RefreshSession.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'revoke-all' }
  );
};

const signResetToken = (user) => jwt.sign(
  // Atamos el token al hash actual: al cambiar la contraseña, el token deja de
  // ser válido (single-use efectivo).
  { userId: user._id, type: 'reset', ph: user.password.slice(-10) },
  RESET_SECRET,
  { expiresIn: process.env.PASSWORD_RESET_EXPIRES_IN || '1h' }
);

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.'
  }
});

// Limiter propio para reseteo de contraseña (no comparte cupo con el login).
const resetLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes de reseteo. Intenta más tarde.' }
});

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    handleError(res, error, 'Error al obtener usuarios');
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json(buildUserResponse(user));
  } catch (error) {
    handleError(res, error, 'Error al obtener perfil');
  }
});

router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, valid: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, valid: true, user: buildUserResponse(user) });
  } catch (error) {
    handleError(res, error, 'Error al verificar token');
  }
});

router.get('/by-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, error: 'El parámetro email es requerido' });
    }
    const user = await User.findOne({ email }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, user: buildUserResponse(user) });
  } catch (error) {
    handleError(res, error, 'Error al buscar usuario por email');
  }
});

router.get('/:id', authenticateToken, requireSelfOrAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    handleError(res, error, 'Error al obtener usuario');
  }
});

router.post('/', validateCreateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // El registro público siempre crea role='user'; el rol lo asigna un admin después.
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'El email ya está registrado' });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: 'user'
    });

    await user.save();
    apiLogger?.info('Usuario creado exitosamente', { userId: user._id, email: user.email });
    await audit('user.create', { req, targetUser: user._id, email: user.email });

    const token = signToken(user);
    res.status(201).json({ ...buildUserResponse(user), token });
  } catch (error) {
    handleError(res, error, 'Error al crear usuario');
  }
});

router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      apiLogger?.warn('Intento de inicio de sesión fallido: usuario no encontrado', { email });
      await audit('user.login.failed', { req, email });
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Cuenta bloqueada por demasiados intentos fallidos.
    if (user.isLocked) {
      apiLogger?.warn('Login rechazado: cuenta bloqueada', { userId: user._id });
      await audit('user.login.locked', { req, targetUser: user._id, email });
      return res.status(423).json({
        success: false,
        error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.registerFailedLogin();
      apiLogger?.warn('Intento de inicio de sesión fallido: contraseña incorrecta', {
        userId: user._id,
        attempts: user.failedLoginAttempts,
        locked: user.isLocked
      });
      await audit(user.isLocked ? 'user.login.locked' : 'user.login.failed', {
        req, targetUser: user._id, email, details: { attempts: user.failedLoginAttempts }
      });
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    await user.resetLoginAttempts();
    const token = signToken(user);
    const refreshToken = await issueRefreshToken(user);
    apiLogger?.info('Inicio de sesión exitoso', { userId: user._id, email: user.email });
    await audit('user.login.success', { req, targetUser: user._id, email });

    res.json({ ...buildUserResponse(user), token, refreshToken });
  } catch (error) {
    handleError(res, error, 'Error en login');
  }
});

// ── Refresh: emite un nuevo access token desde un refresh token válido ──
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken requerido' });
    }
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Refresh token inválido o expirado' });
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      return res.status(401).json({ success: false, error: 'Tipo de token inválido' });
    }
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ success: false, error: 'Usuario no encontrado' });

    // Rotación atómica: sólo la primera presentación del token lo consume.
    const session = await RefreshSession.findOneAndUpdate(
      { jti: payload.jti, user: user._id, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'rotated' }
    );
    if (!session) {
      // Token ya rotado que vuelve a usarse: posible robo.
      // Se cierran todas las sesiones del usuario.
      const rotated = await RefreshSession.exists({ jti: payload.jti, revokedReason: 'rotated' });
      if (rotated) {
        await revokeAllSessions(user._id);
        apiLogger?.warn('Reuso de refresh token detectado', { userId: user._id });
        await audit('user.refresh.reuse', { req, targetUser: user._id, email: user.email });
      }
      return res.status(401).json({ success: false, error: 'Refresh token inválido o expirado' });
    }
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ success: false, error: 'Refresh token revocado' });
    }

    const rotatedRefreshToken = await issueRefreshToken(user);
    res.json({ ...buildUserResponse(user), token: signToken(user), refreshToken: rotatedRefreshToken });
  } catch (error) {
    handleError(res, error, 'Error al refrescar token');
  }
});

// ── Logout: revoca el refresh token de esta sesión ─────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken requerido' });
    }
    try {
      const payload = jwt.verify(refreshToken, REFRESH_SECRET);
      if (payload.jti) {
        await RefreshSession.updateOne(
          { jti: payload.jti, revokedAt: null },
          { revokedAt: new Date(), revokedReason: 'logout' }
        );
      }
    } catch {
      // Token inválido o vencido: no hay sesión que cerrar. Respuesta idempotente.
    }
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (error) {
    handleError(res, error, 'Error al cerrar sesión');
  }
});

// ── Logout global: invalida access y refresh tokens en todos los dispositivos ──
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await revokeAllSessions(req.user._id);
    await audit('user.logout.all', { req, targetUser: req.user._id, email: req.user.email });
    res.json({ success: true, message: 'Todas las sesiones fueron cerradas' });
  } catch (error) {
    handleError(res, error, 'Error al cerrar sesiones');
  }
});

// ── Password reset: solicitud ─────────────────────────────────────────
// Respuesta genérica (no revela si el email existe). En dev devolvemos el
// token para poder probar el flujo sin servidor de correo.
router.post('/password-reset/request', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'email requerido' });

    const user = await User.findOne({ email });
    const generic = { success: true, message: 'Si el email existe, se enviaron instrucciones de reseteo.' };

    if (!user) return res.json(generic);

    const resetToken = signResetToken(user);
    // En producción acá iría el envío por email (SMTP/servicio). Por ahora se
    // registra en el log y, sólo con NODE_ENV explícito de dev/test, se devuelve
    // en la respuesta. Un NODE_ENV sin definir NO expone el token.
    apiLogger?.info('Password reset solicitado', { userId: user._id, email });
    await audit('user.update', { req, targetUser: user._id, email, details: { action: 'password-reset-request' } });

    if (['development', 'test'].includes(process.env.NODE_ENV)) {
      return res.json({ ...generic, resetToken });
    }
    res.json(generic);
  } catch (error) {
    handleError(res, error, 'Error en solicitud de reseteo');
  }
});

// ── Password reset: confirmación ──────────────────────────────────────
router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'token y newPassword requeridos' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    let payload;
    try {
      payload = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Token de reseteo inválido o expirado' });
    }
    if (payload.type !== 'reset') {
      return res.status(401).json({ success: false, error: 'Tipo de token inválido' });
    }
    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    // El token está atado al hash anterior: si ya cambió, es inválido (single-use).
    if (payload.ph !== user.password.slice(-10)) {
      return res.status(401).json({ success: false, error: 'El token ya fue utilizado' });
    }

    user.password = newPassword; // pre('save') re-hashea
    user.failedLoginAttempts = 0; // limpia lockout previo
    user.lockUntil = undefined;
    await user.save();
    // Cambió la contraseña: cualquier sesión abierta (posiblemente del atacante) se cierra.
    await revokeAllSessions(user._id);
    apiLogger?.info('Password reseteado', { userId: user._id });
    await audit('user.update', { req, targetUser: user._id, email: user.email, details: { action: 'password-reset-confirm' } });

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al confirmar reseteo');
  }
});

router.put('/:id', authenticateToken, requireSelfOrAdmin, async (req, res) => {
  try {
    const updates = pickAllowedUpdates(req.body, req.user.role === 'admin');

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await audit('user.update', { req, targetUser: user._id, email: user.email, details: { fields: Object.keys(updates) } });
    res.json(user);
  } catch (error) {
    handleError(res, error, 'Error al actualizar usuario');
  }
});

router.patch('/:id', authenticateToken, requireSelfOrAdmin, async (req, res) => {
  try {
    const updates = pickAllowedUpdates(req.body, req.user.role === 'admin');

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    handleError(res, error, 'Error al actualizar usuario');
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'No puede eliminar su propio usuario' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar usuario');
  }
});

export default router;
