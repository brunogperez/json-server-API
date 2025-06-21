import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('🔍 Auth Debug - Header:', authHeader ? 'Presente' : 'Ausente');
    console.log('🔍 Auth Debug - Token:', token ? 'Extraído correctamente' : 'No extraído');

    if (!token) {
      console.log('❌ Auth Debug - No token provided');
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET no definido en las variables de entorno');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    console.log('🔍 Auth Debug - Verificando token con JWT_SECRET...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Auth Debug - Token decodificado:', { userId: decoded.userId, email: decoded.email });
    
    const user = await User.findById(decoded.userId).select('-password');
    console.log('🔍 Auth Debug - Usuario buscado:', user ? `${user.email} (${user._id})` : 'No encontrado');
    
    if (!user) {
      console.log('❌ Auth Debug - Usuario no encontrado en DB');
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = user;
    console.log('✅ Auth Debug - Usuario autenticado correctamente');
    next();
  } catch (error) {
    console.error('❌ Auth Debug - Error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expirado' });
    }
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador' });
  }
  next();
};

export { authenticateToken, requireAdmin };