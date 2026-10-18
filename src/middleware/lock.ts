import type { RequestHandler } from 'express';
import { HttpError } from '../errors.js';
import { getSettings } from '../models/setting.js';

export const requireUnlocked: RequestHandler = async (_req, _res, next) => {
  const { locked } = await getSettings();
  if (locked) {
    throw new HttpError(423, 'The system is locked. Unlock it to change users or candidates.');
  }
  next();
};
