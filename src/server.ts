import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

await mongoose.connect(config.MONGO_URL);

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
