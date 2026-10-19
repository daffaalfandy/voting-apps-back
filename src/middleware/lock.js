import { LockedError } from '../errors.js';
import * as settingsService from '../services/settings.js';

export const requireUnlocked = async (_req, _res, next) => {
  const { locked } = await settingsService.get();
  if (locked) {
    throw new LockedError('The system is locked. Unlock it to change users or candidates.');
  }
  next();
};
