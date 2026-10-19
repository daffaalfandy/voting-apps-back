import { Router } from 'express';
import * as participationController from '../controllers/participation.js';

export const participationRouter = Router();

participationRouter.get('/', participationController.list);
