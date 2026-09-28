import mongoose from 'mongoose';

// Cada archivo de test usa su propia base dentro del replica set compartido,
// así pueden correr en paralelo sin pisarse.
export const connectTestDb = async (name) => {
  await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: `test_${name}` });
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
};

export const disconnectTestDb = async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
};
