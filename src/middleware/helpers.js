import { validationResult } from 'express-validator';
import { apiLogger } from './logger.js';

export const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

export const handleError = (res, error, context) => {
  apiLogger?.error(context, { error: error.message, stack: error.stack });
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: Object.values(error.errors).map(e => e.message).join(', ')
    });
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'campo';
    return res.status(409).json({
      success: false,
      error: 'Valor duplicado',
      details: `El ${field} ya existe`
    });
  }
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};
