import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import * as settingsRepository from '../repositories/settings.js';

const updateSchema = z.object({ locked: z.boolean('locked must be true or false') });

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json({ settings: await settingsRepository.get() });
});

settingsRouter.put('/', requireRole('admin'), async (req, res) => {
  res.json({ settings: await settingsRepository.update(updateSchema.parse(req.body)) });
});
