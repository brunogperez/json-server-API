// IMPORTANTE: carga el .env ANTES de importar la app. Los `import` de ESM se
// ejecutan en orden, y varias rutas (p.ej. users.js) construyen su rate-limiter
// leyendo process.env a nivel de módulo. Si dotenv corriera después, esos
// limiters caerían al default. Este side-effect import garantiza el orden.
import 'dotenv/config';
import './config/checkEnv.js';

import mongoose from 'mongoose';

import app from './app.js';
import { logger } from './middleware/logger.js';

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
