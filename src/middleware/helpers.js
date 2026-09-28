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

// Convierte el query param `search` en un patrón literal seguro para $regex:
// ignora valores no string (p.ej. ?search[$ne]=x o ?search=a&search=b), limita
// el largo y escapa metacaracteres para evitar ReDoS y búsquedas no intencionadas.
const MAX_SEARCH_LENGTH = 100;

export const searchPattern = (search) => {
  if (typeof search !== 'string') return null;
  const trimmed = search.trim().slice(0, MAX_SEARCH_LENGTH);
  if (!trimmed) return null;
  return trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
