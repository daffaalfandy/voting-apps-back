import { Router } from 'express';
import * as healthController from '../controllers/health.js';

export const healthRouter = Router();

healthRouter.get('/', healthController.show);
