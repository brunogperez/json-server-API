import winston from 'winston';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

// Consola legible en dev, JSON estructurado en prod.
const consoleFormat = isProd
  ? combine(timestamp(), errors({ stack: true }), json())
  : combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      printf(({ level, message, timestamp: ts, ...meta }) => {
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${ts} ${level}: ${message}${rest}`;
      })
    );

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    // Archivo de errores persistido; rota por tamaño.
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// Middleware de request logging estructurado.
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level === 'http' ? 'info' : level, 'request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    });
  });
  next();
};

// Compat: apiLogger conserva la interfaz info/warn/error usada en todo el código.
export const apiLogger = {
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
};
