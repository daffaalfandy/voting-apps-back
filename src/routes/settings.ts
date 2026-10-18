import { Router } from 'express';
import { z } from 'zod';
import { getSettings, updateSettings } from '../models/setting.js';

const updateSchema = z.object({ locked: z.boolean('locked must be true or false') });

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json({ settings: await getSettings() });
});

settingsRouter.put('/', async (req, res) => {
  res.json({ settings: await updateSettings(updateSchema.parse(req.body)) });
});
