import { body, param } from 'express-validator';

export const validateCreatePlan = [
  body('name').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 100 }),
  body('description').optional().trim(),
  body('serviceType').trim().notEmpty().withMessage('Tipo de servicio requerido'),
  body('durationDays').isInt({ min: 1 }).withMessage('Duración en días debe ser entero >= 1'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacidad debe ser entero >= 1'),
  body('creditCost').isInt({ min: 0 }).withMessage('Costo en créditos debe ser entero >= 0'),
  body('ownerPrice').isFloat({ min: 0 }).withMessage('Precio owner debe ser número >= 0'),
  body('suggestedResellerPrice').isFloat({ min: 0 }).withMessage('Precio sugerido reseller debe ser número >= 0'),
  body('credentialFields').optional().isArray().withMessage('credentialFields debe ser array de strings'),
  body('metadata').optional().isObject().withMessage('metadata debe ser objeto'),
  body('active').optional().isBoolean()
];

export const validateUpdatePlan = [
  body('name').optional().trim().isLength({ max: 100 }),
  body('description').optional().trim(),
  body('serviceType').optional().trim().notEmpty(),
  body('durationDays').optional().isInt({ min: 1 }),
  body('capacity').optional().isInt({ min: 1 }),
  body('creditCost').optional().isInt({ min: 0 }),
  body('ownerPrice').optional().isFloat({ min: 0 }),
  body('suggestedResellerPrice').optional().isFloat({ min: 0 }),
  body('credentialFields').optional().isArray(),
  body('metadata').optional().isObject(),
  body('active').optional().isBoolean()
];

export const validateMongoId = [
  param('id').isMongoId().withMessage('ID inválido')
];
