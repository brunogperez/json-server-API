import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import { router as userRoutes } from './routes/users.js';
import { router as clientRoutes } from './routes/clients.js';
import { router as productRoutes } from './routes/products.js';
import { router as inscriptionRoutes } from './routes/inscriptions.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
const MONGODB_URI = process.env.MONGODB_URI 

mongoose.connect(MONGODB_URI, {
  dbName: 'fenixAPI'
})
.then(() => console.log('Conectado a la Base de datos'))
.catch(err => console.error('Error conectando a la Base de datos:', err));

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inscriptions', inscriptionRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});