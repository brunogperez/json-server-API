import express from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateCreateUser, validateLogin } from '../validators/userValidators.js';
import { apiLogger } from '../middleware/logger.js';

// Middleware para manejar errores de forma consistente
const handleError = (res, error, context = 'Error en el servidor') => {
  console.error(`${context}:`, error);
  apiLogger.error(context, { error: error.message, stack: error.stack });
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

const router = express.Router();

// Obtener todos los usuarios
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener usuario por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nuevo usuario
router.post('/', validateCreateUser, async (req, res, next) => {
  try {
    // Validar los datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email, password, role } = req.body;
    
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'El email ya está registrado' 
      });
    }

    // Crear el nuevo usuario
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: role || 'user'
    });

    await user.save();
    
    // Registrar la creación exitosa
    apiLogger.info('Usuario creado exitosamente', { userId: user._id, email: user.email });
    
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    user.token = token;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Formatear response para compatibilidad con frontend
    const userResponse = {
      _id: user._id,
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json(userResponse);
  } catch (error) {
    handleError(res, error, 'Error al obtener perfil');
  }
});

// Verificar token y devolver datos del usuario
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        valid: false,
        error: 'Usuario no encontrado' 
      });
    }

    res.json({ 
      success: true,
      valid: true, 
      user: {
        _id: user._id,
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    handleError(res, error, 'Error al verificar token');
  }
});

// Buscar usuario por email
router.get('/by-email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro email es requerido'
      });
    }

    const user = await User.findOne({ email }).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    handleError(res, error, 'Error al buscar usuario por email');
  }
});

// Iniciar sesión
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Validar los datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Datos de entrada inválidos',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      apiLogger.warn('Intento de inicio de sesión fallido: usuario no encontrado', { email });
      return res.status(400).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }

    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      apiLogger.warn('Intento de inicio de sesión fallido: contraseña incorrecta', { userId: user._id });
      return res.status(400).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }

    // Generar token JWT con más datos del usuario
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    user.token = token;
    await user.save();

    // Preparar respuesta con formato consistente
    const userResponse = {
      _id: user._id,
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      token: token
    };

    res.json(userResponse);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar usuario
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // No permitir actualizar password por esta ruta
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar usuario
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;