// App Express sin efectos secundarios (no conecta a Mongo ni hace listen), para
// poder montarla en tests con supertest. El arranque real vive en index.js.
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
import { requestLogger } from './middleware/logger.js';
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

export default app;
