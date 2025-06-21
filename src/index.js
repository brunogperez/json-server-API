import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Importar rutas
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import productRoutes from './routes/products.js';
import inscriptionRoutes from './routes/inscriptions.js';

// Importar middlewares
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

dotenv.config();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  }
});

// Middlewares de seguridad
app.use(helmet());
app.use(compression());
app.use(limiter);

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
};
app.use(cors(corsOptions));

// Middlewares básicos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Conexión a MongoDB
const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenixAPI';
    await mongoose.connect(MONGODB_URI, { dbName: process.env.DB_NAME });
    console.log(`✅ Conectado a MongoDB: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

connectDB();

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inscriptions', inscriptionRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Fenix funcionando correctamente',
    version: '2.0.0'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Error handler (debe ir al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
});

export default app;