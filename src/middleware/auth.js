import mongoose from 'mongoose';
import { verifyToken } from '../auth/token.js';
import { AuthenticationError, ForbiddenError } from '../errors.js';
import { User } from '../models/user.js';

export const requireAuth = async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  let userId;
  try {
    userId = verifyToken(token);
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }

  const user = mongoose.isValidObjectId(userId) ? await User.findById(userId) : null;
  if (!user) {
    throw new AuthenticationError('Invalid or expired token');
  }
  if (user.status === 'suspended') {
    throw new ForbiddenError('This account is suspended. Contact the election administrator.');
  }

  req.user = user;
  next();
};

export const requireRole = (role) => (req, _res, next) => {
  if (req.user?.role !== role) {
    throw new ForbiddenError('You do not have access to this resource');
  }
  next();
};

export function currentUser(req) {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  return req.user;
}
