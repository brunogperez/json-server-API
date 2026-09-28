import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { apiLogger } from './logger.js';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    if (!process.env.JWT_SECRET) {
      apiLogger?.error('JWT_SECRET no definido en las variables de entorno');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Tokens emitidos antes de un logout-all / reseteo quedan inválidos.
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Token revocado' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expirado' });
    }
    apiLogger?.error('Error de autenticación', { error: error.message });
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador' });
  }
  next();
};

const requireSelfOrAdmin = (req, res, next) => {
  const targetId = req.params.id;
  if (req.user.role === 'admin' || req.user._id.toString() === targetId) {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado. Solo puede modificar su propio usuario' });
};

// Multi-tenancy (Story 19): permite admin o reseller. Un reseller debe tener
// resellerProfile vinculado para poder operar.
const requireAdminOrReseller = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'reseller') {
    if (!req.user.resellerProfile) {
      return res.status(403).json({ error: 'Usuario reseller sin perfil vinculado' });
    }
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado' });
};

// Devuelve el id del reseller al que se debe limitar la consulta, o null si es
// admin (sin límite). Útil para forzar el aislamiento en los handlers.
const resellerScopeId = (req) =>
  req.user.role === 'reseller' ? req.user.resellerProfile?.toString() : null;

export { authenticateToken, requireAdmin, requireSelfOrAdmin, requireAdminOrReseller, resellerScopeId };
