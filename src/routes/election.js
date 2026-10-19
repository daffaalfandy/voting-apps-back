import { Router } from 'express';
import * as electionController from '../controllers/election.js';

export const electionRouter = Router();

electionRouter.post('/reset', electionController.reset);
