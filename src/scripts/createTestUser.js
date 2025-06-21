import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createTestUser = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/education_api');
    console.log('✅ Conectado a MongoDB');

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email: 'admin@mail.com' });
    
    if (existingUser) {
      console.log('✅ Usuario admin@mail.com ya existe');
      console.log('📧 Email: admin@mail.com');
      console.log('🔑 Password: 123123123');
      await mongoose.disconnect();
      return;
    }

    // Crear usuario admin
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@mail.com',
      password: '123123123',  // Se hasheará automáticamente
      role: 'admin'
    });

    await adminUser.save();
    console.log('✅ Usuario admin creado exitosamente');
    console.log('📧 Email: admin@mail.com');
    console.log('🔑 Password: 123123123');

  } catch (error) {
    console.error('❌ Error creando usuario:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

createTestUser();
