import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { seedDatabase } from './seed.js';

await mongoose.connect(config.MONGO_URL);

const seeded = await seedDatabase({
  admin: { name: config.ADMIN_NAME, email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
  demo: config.SEED_DEMO,
});
if (seeded) {
  console.log(`Seeded admin ${config.ADMIN_EMAIL}${config.SEED_DEMO ? ' and demo data' : ''}`);
}

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on port ${config.PORT}`);
});

const shutdown = () => {
  server.close(() => {
    void mongoose.disconnect().then(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
