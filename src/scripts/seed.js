import mongoose from 'mongoose';
import { config } from '../config.js';
import { seedDatabase } from '../seed.js';

await mongoose.connect(config.MONGO_URL);

const seeded = await seedDatabase({
  admin: { name: config.ADMIN_NAME, email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
  demo: config.SEED_DEMO,
});
console.log(
  seeded
    ? `Seeded admin ${config.ADMIN_EMAIL}${config.SEED_DEMO ? ' and demo data' : ''}`
    : 'The database already has users, so nothing was seeded',
);

await mongoose.disconnect();
