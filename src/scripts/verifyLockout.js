import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { MAX_LOGIN_ATTEMPTS } from '../models/User.js';

dotenv.config();

/**
 * Verifica la lógica de lockout de cuenta (Story 18) a nivel de modelo, sin
 * pasar por HTTP (evita el rate limit de login por IP). Crea un usuario
 * temporal, simula intentos fallidos y comprueba el bloqueo y el reset.
 */
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });

  const email = `lockout.test.${Date.now()}@example.com`;
  const user = await User.create({
    firstName: 'Lock', lastName: 'Test', email, password: 'secret123', role: 'user',
  });

  let ok = true;
  for (let i = 1; i <= MAX_LOGIN_ATTEMPTS; i++) {
    await user.registerFailedLogin();
    console.log(`  intento ${i}: attempts=${user.failedLoginAttempts} locked=${user.isLocked}`);
  }

  if (!user.isLocked) { console.log('❌ No se bloqueó tras MAX intentos'); ok = false; }
  else console.log(`✅ Cuenta bloqueada tras ${MAX_LOGIN_ATTEMPTS} intentos (lockUntil=${user.lockUntil?.toISOString()})`);

  await user.resetLoginAttempts();
  if (user.isLocked || user.failedLoginAttempts !== 0) { console.log('❌ reset no limpió el estado'); ok = false; }
  else console.log('✅ resetLoginAttempts limpió el bloqueo');

  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
};

run().catch((e) => { console.error(e); process.exit(1); });
