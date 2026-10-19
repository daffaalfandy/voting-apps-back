import { Router } from 'express';
import * as candidatesController from '../controllers/candidates.js';
import { requireRole } from '../middleware/auth.js';
import { requireUnlocked } from '../middleware/lock.js';

export const candidatesRouter = Router();

candidatesRouter.get('/', candidatesController.list);
candidatesRouter.post('/', requireRole('admin'), requireUnlocked, candidatesController.create);
candidatesRouter.delete('/:id', requireRole('admin'), requireUnlocked, candidatesController.remove);
