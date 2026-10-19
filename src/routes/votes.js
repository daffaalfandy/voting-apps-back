import { Router } from 'express';
import * as votesController from '../controllers/votes.js';

export const votesRouter = Router();

votesRouter.post('/', votesController.cast);
votesRouter.get('/me', votesController.mine);
