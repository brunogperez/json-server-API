import { body } from 'express-validator';

export const validateCreateUser = [
  body('firstName')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2 })
    .withMessage('El nombre debe tener al menos 2 caracteres'),
  
  body('lastName')
    .notEmpty()
    .withMessage('El apellido es requerido')
    .isLength({ min: 2 })
    .withMessage('El apellido debe tener al menos 2 caracteres'),
  
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  body('role')
    .optional()
    .isIn(['admin', 'user'])
    .withMessage('El rol debe ser admin o user')
];

export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];
