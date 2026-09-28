// IMPORTANTE: carga el .env ANTES de importar las rutas. Los `import` de ESM se
// ejecutan en orden, y varias rutas (p.ej. users.js) construyen su rate-limiter
// leyendo process.env a nivel de módulo. Si dotenv corriera después, esos
// limiters caerían al default. Este side-effect import garantiza el orden.
import 'dotenv/config';
import './config/checkEnv.js';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import userRoutes from './routes/users.js';
import resellerRoutes from './routes/resellers.js';
import endCustomerRoutes from './routes/endCustomers.js';
import planRoutes from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import creditTransactionRoutes from './routes/creditTransactions.js';

import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger, logger } from './middleware/logger.js';
import { swaggerSpec } from './config/swagger.js';

const app = express();

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  }
});

app.use(helmet());
app.use(compression());
app.use(limiter);

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://127.0.0.1:4200'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization']
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Conexión a MongoDB con manejo de reconexión ──────────────────────
mongoose.connection.on('connected', () => logger.info('MongoDB conectado', { db: process.env.DB_NAME }));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado, reintentando...'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconectado'));
mongoose.connection.on('error', (err) => logger.error('MongoDB error', { error: err.message }));

const connectDB = async (retries = 5, delayMs = 3000) => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenixAPI';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, {
        dbName: process.env.DB_NAME,
        serverSelectionTimeoutMS: 10000,
      });
      return;
    } catch (error) {
      logger.error(`Fallo conexión MongoDB (intento ${attempt}/${retries})`, { error: error.message });
      if (attempt === retries) {
        logger.error('No se pudo conectar a MongoDB tras varios intentos. Saliendo.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

// ── Rutas (versionadas /api/v1 + alias /api para compatibilidad) ─────
const mountRoutes = (prefix) => {
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/resellers`, resellerRoutes);
  app.use(`${prefix}/end-customers`, endCustomerRoutes);
  app.use(`${prefix}/plans`, planRoutes);
  app.use(`${prefix}/subscriptions`, subscriptionRoutes);
  app.use(`${prefix}/credit-transactions`, creditTransactionRoutes);
};
mountRoutes('/api/v1');
mountRoutes('/api'); // alias sin versión (el frontend usa /api)

// ── Documentación OpenAPI ────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Reseller Services API',
    version: '3.0.0',
    docs: '/api/docs'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

let server;
const start = async () => {
  await connectDB();
  server = app.listen(PORT, () => {
    logger.info('Servidor iniciado', { port: PORT, env: process.env.NODE_ENV || 'development' });
    console.log(`🚀 Servidor corriendo en puerto ${PORT} — docs en /api/docs`);
  });
};

// ── Graceful shutdown ────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`Señal ${signal} recibida: cerrando servidor...`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close(false);
    logger.info('Cierre limpio completado.');
    process.exit(0);
  } catch (error) {
    logger.error('Error durante el cierre', { error: error.message });
    process.exit(1);
  }
};

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { reason: String(reason) }));

start();

export default app;
