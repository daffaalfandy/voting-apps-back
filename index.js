import express from 'express';
import mongoose from 'mongoose';
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { errorHandler } from './src/middleware/error.js';

let connection;

function connect() {
  connection ??= mongoose.connect(config.MONGO_URL).catch((err) => {
    connection = undefined;
    throw err;
  });
  return connection;
}

const app = express();

app.use(async (_req, _res, next) => {
  await connect();
  next();
});
app.use(createApp());
app.use(errorHandler);

export default app;
