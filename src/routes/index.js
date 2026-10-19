import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authRouter } from './auth.js';
import { candidatesRouter } from './candidates.js';
import { electionRouter } from './election.js';
import { healthRouter } from './health.js';
import { participationRouter } from './participation.js';
import { resultsRouter } from './results.js';
import { settingsRouter } from './settings.js';
import { usersRouter } from './users.js';
import { votesRouter } from './votes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', requireAuth, requireRole('admin'), usersRouter);
apiRouter.use('/candidates', requireAuth, candidatesRouter);
apiRouter.use('/votes', requireAuth, requireRole('voter'), votesRouter);
apiRouter.use('/settings', requireAuth, settingsRouter);
apiRouter.use('/results', requireAuth, requireRole('admin'), resultsRouter);
apiRouter.use('/participation', requireAuth, requireRole('admin'), participationRouter);
apiRouter.use('/election', requireAuth, requireRole('admin'), electionRouter);
