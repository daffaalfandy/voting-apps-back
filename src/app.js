import express from 'express';
import helmet from 'helmet';
import { requireAuth, requireRole } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { candidatesRouter } from './routes/candidates.js';
import { electionRouter } from './routes/election.js';
import { healthRouter } from './routes/health.js';
import { participationRouter } from './routes/participation.js';
import { resultsRouter } from './routes/results.js';
import { settingsRouter } from './routes/settings.js';
import { usersRouter } from './routes/users.js';
import { votesRouter } from './routes/votes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', requireAuth, requireRole('admin'), usersRouter);
  app.use('/api/candidates', requireAuth, candidatesRouter);
  app.use('/api/votes', requireAuth, requireRole('voter'), votesRouter);
  app.use('/api/settings', requireAuth, settingsRouter);
  app.use('/api/results', requireAuth, requireRole('admin'), resultsRouter);
  app.use('/api/participation', requireAuth, requireRole('admin'), participationRouter);
  app.use('/api/election', requireAuth, requireRole('admin'), electionRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
