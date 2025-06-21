export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  console.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: message,
      timestamp: new Date().toISOString()
    });
  }

  // Error de ID inválido de MongoDB
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido',
      details: 'El ID proporcionado no tiene un formato válido',
      timestamp: new Date().toISOString()
    });
  }

  // Error de clave duplicada
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return res.status(400).json({
      success: false,
      error: 'Valor duplicado',
      details: `El ${field} '${value}' ya existe`,
      timestamp: new Date().toISOString()
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token inválido',
      details: 'Token de autenticación no válido',
      timestamp: new Date().toISOString()
    });
  }

  // Error de JWT expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expirado',
      details: 'El token de autenticación ha expirado',
      timestamp: new Date().toISOString()
    });
  }

  // Error por defecto
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode === 500 ? 'Error interno del servidor' : error.message,
    timestamp: new Date().toISOString()
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
