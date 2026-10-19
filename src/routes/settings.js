import { Router } from 'express';
import * as settingsController from '../controllers/settings.js';
import { requireRole } from '../middleware/auth.js';

export const settingsRouter = Router();

settingsRouter.get('/', settingsController.show);
settingsRouter.put('/', requireRole('admin'), settingsController.update);
