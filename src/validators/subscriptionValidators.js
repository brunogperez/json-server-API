import { body, param } from 'express-validator';
import { SUBSCRIPTION_STATUSES } from '../models/Subscription.js';

export const validateCreateSubscription = [
  body('endCustomer').isMongoId().withMessage('ID de cliente final inválido'),
  body('plan').isMongoId().withMessage('ID de plan inválido'),
  body('soldBy').optional().isMongoId().withMessage('ID de reseller inválido'),
  body('salePrice').isFloat({ min: 0 }).withMessage('Precio venta debe ser número >= 0'),
  body('startDate').optional().isISO8601().toDate(),
  body('credentials').optional().isObject().withMessage('credentials debe ser objeto'),
  body('notes').optional().trim()
];

export const validateUpdateSubscription = [
  body('salePrice').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(SUBSCRIPTION_STATUSES),
  body('credentials').optional().isObject(),
  body('notes').optional().trim()
];

export const validateRenew = [
  body('plan').optional().isMongoId(),
  body('salePrice').optional().isFloat({ min: 0 })
];

export const validateMongoId = [
  param('id').isMongoId().withMessage('ID inválido')
];
