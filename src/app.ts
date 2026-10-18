import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/error.js';
import { authRouter } from './routes/auth.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
