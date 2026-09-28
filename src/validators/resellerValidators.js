import { body, param } from 'express-validator';

export const validateCreateReseller = [
  body('firstName').trim().notEmpty().withMessage('Nombre requerido').isLength({ min: 2 }),
  body('lastName').trim().notEmpty().withMessage('Apellido requerido').isLength({ min: 2 }),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('phone').optional().trim(),
  body('businessName').optional().trim(),
  body('credits').optional().isInt({ min: 0 }).withMessage('Créditos debe ser entero >= 0'),
  body('notes').optional().trim()
];

export const validateUpdateReseller = [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('businessName').optional().trim(),
  body('active').optional().isBoolean(),
  body('notes').optional().trim()
];

export const validateTopup = [
  body('amount').isInt({ min: 1 }).withMessage('Cantidad debe ser entero >= 1'),
  body('note').optional().trim()
];

export const validateAdjust = [
  body('amount').isInt().withMessage('Cantidad debe ser entero (positivo o negativo)'),
  body('note').optional().trim()
];

export const validateMongoId = [
  param('id').isMongoId().withMessage('ID inválido')
];
