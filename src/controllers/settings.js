import { z } from 'zod';
import * as settingsService from '../services/settings.js';

const updateSchema = z.object({ locked: z.boolean('locked must be true or false') });

export async function show(_req, res) {
  res.json({ settings: await settingsService.get() });
}

export async function update(req, res) {
  res.json({ settings: await settingsService.update(updateSchema.parse(req.body)) });
}
