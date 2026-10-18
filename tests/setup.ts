import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';

beforeAll(async () => {
  const url = process.env.MONGO_URL!;
  await mongoose.connect(url);
  // Guard against wiping a real database when MONGO_URL is misconfigured.
  if (!mongoose.connection.name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${mongoose.connection.name}"`);
  }
  await mongoose.syncIndexes();
});

beforeEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
