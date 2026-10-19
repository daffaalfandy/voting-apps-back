import { LockedError } from '../errors.js';
import { getSettings } from '../models/setting.js';

export const requireUnlocked = async (_req, _res, next) => {
  const { locked } = await getSettings();
  if (locked) {
    throw new LockedError('The system is locked. Unlock it to change users or candidates.');
  }
  next();
};
