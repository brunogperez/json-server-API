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
  if (apiLogger) {
    apiLogger.error(context, { error: error.message, stack: error.stack });
  }
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
    handleError(res, error, 'Error al obtener usuarios');
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

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

router.get('/:id', authenticateToken, async (req, res) => {
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
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'El email ya está registrado' 
      });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: role || 'user'
    });

    await user.save();
    
    if (apiLogger) {
      apiLogger.info('Usuario creado exitosamente', { userId: user._id, email: user.email });
    }
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

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

    res.status(201).json(userResponse);
  } catch (error) {
    handleError(res, error, 'Error al crear usuario');
  }
});

router.post('/login', validateLogin, async (req, res) => {
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
      if (apiLogger) {
        apiLogger.warn('Intento de inicio de sesión fallido: usuario no encontrado', { email });
      }
      return res.status(400).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      if (apiLogger) {
        apiLogger.warn('Intento de inicio de sesión fallido: contraseña incorrecta', { userId: user._id });
      }
      return res.status(400).json({ 
        success: false,
        error: 'Credenciales inválidas' 
      });
    }

    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (apiLogger) {
      apiLogger.info('Inicio de sesión exitoso', { userId: user._id, email: user.email });
    }
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
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    
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
    handleError(res, error, 'Error al actualizar usuario');
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
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