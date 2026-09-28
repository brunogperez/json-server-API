import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Replica set (no standalone): las rutas de créditos y suscripciones usan
// transacciones, que Mongo sólo soporta en replica sets.
export default async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.TEST_MONGO_URI = replSet.getUri();
};
