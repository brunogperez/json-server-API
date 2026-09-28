import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subscription from '../models/Subscription.js';
import { isEncrypted } from '../utils/crypto.js';

dotenv.config();

/**
 * Verifica el cifrado de credenciales en reposo (Story 18).
 *  - Lectura .lean() => salta post('init') => credenciales CRUDAS (cifradas).
 *  - Lectura normal  => post('init') descifra => texto plano.
 */
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME });

  const rawAny = await Subscription.find().lean();
  const sample = rawAny.find((s) => s.credentials && Object.keys(s.credentials).length > 0);

  if (!sample) {
    console.log('⚠️  No hay suscripciones con credenciales para verificar.');
    await mongoose.disconnect();
    return;
  }

  const rawValues = Object.values(sample.credentials).filter((v) => typeof v === 'string');
  const allEncrypted = rawValues.every(isEncrypted);

  console.log('— Lectura cruda (.lean), en reposo:');
  console.log('  ', sample.credentials);
  console.log(`  ¿todos cifrados? ${allEncrypted ? '✅ SÍ' : '❌ NO'}`);

  const hydrated = await Subscription.findById(sample._id);
  const plainValues = [...hydrated.credentials.values()].filter((v) => typeof v === 'string');
  const noneEncrypted = plainValues.every((v) => !isEncrypted(v));

  console.log('— Lectura hidratada (post-init), descifrada:');
  console.log('  ', Object.fromEntries(hydrated.credentials));
  console.log(`  ¿descifrado OK? ${noneEncrypted ? '✅ SÍ' : '❌ NO'}`);

  await mongoose.disconnect();
  process.exit(allEncrypted && noneEncrypted ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
