import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../models/setting.js';

const updateSchema = z.object({ locked: z.boolean('locked must be true or false') });

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json({ settings: await getSettings() });
});

settingsRouter.put('/', requireRole('admin'), async (req, res) => {
  res.json({ settings: await updateSettings(updateSchema.parse(req.body)) });
});
