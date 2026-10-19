import { Router } from 'express';
import * as resultsController from '../controllers/results.js';

export const resultsRouter = Router();

resultsRouter.get('/', resultsController.show);
