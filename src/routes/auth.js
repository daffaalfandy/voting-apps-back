import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', authController.loginVoter);
authRouter.post('/admin/login', authController.loginAdmin);
authRouter.get('/me', requireAuth, authController.me);
