import mongoose from 'mongoose';
import { verifyToken } from '../auth/token.js';
import { HttpError } from '../errors.js';
import { User } from '../models/user.js';

export const requireAuth = async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  let userId;
  try {
    userId = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = mongoose.isValidObjectId(userId) ? await User.findById(userId) : null;
  if (!user) {
    throw new HttpError(401, 'Invalid or expired token');
  }
  if (user.status === 'suspended') {
    throw new HttpError(403, 'This account is suspended. Contact the election administrator.');
  }

  req.user = user;
  next();
};

export const requireRole = (role) => (req, _res, next) => {
  if (req.user?.role !== role) {
    throw new HttpError(403, 'You do not have access to this resource');
  }
  next();
};

export function currentUser(req) {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }
  return req.user;
}
