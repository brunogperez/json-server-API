import { body, param } from 'express-validator';

export const validateCreateEndCustomer = [
  body('firstName').trim().notEmpty().withMessage('Nombre requerido').isLength({ min: 2 }),
  body('lastName').trim().notEmpty().withMessage('Apellido requerido').isLength({ min: 2 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido').normalizeEmail(),
  body('phone').optional().trim(),
  body('reseller').isMongoId().withMessage('ID de reseller inválido'),
  body('notes').optional().trim()
];

export const validateUpdateEndCustomer = [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('reseller').optional().isMongoId(),
  body('active').optional().isBoolean(),
  body('notes').optional().trim()
];

export const validateMongoId = [
  param('id').isMongoId().withMessage('ID inválido')
];
