import { LockedError } from '../errors.js';
import * as settingsRepository from '../repositories/settings.js';

export const requireUnlocked = async (_req, _res, next) => {
  const { locked } = await settingsRepository.get();
  if (locked) {
    throw new LockedError('The system is locked. Unlock it to change users or candidates.');
  }
  next();
};
