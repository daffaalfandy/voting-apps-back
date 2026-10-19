import { Router } from 'express';
import * as usersController from '../controllers/users.js';
import { requireUnlocked } from '../middleware/lock.js';

export const usersRouter = Router();

usersRouter.get('/', usersController.list);
usersRouter.post('/', requireUnlocked, usersController.create);
usersRouter.patch('/:id', requireUnlocked, usersController.update);
usersRouter.post('/:id/vote-code', requireUnlocked, usersController.issueVoteCode);
usersRouter.delete('/:id', requireUnlocked, usersController.remove);
usersRouter.delete('/:id/vote', requireUnlocked, usersController.resetVote);
