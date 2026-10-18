import type { Request, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../auth/token.js';
import { HttpError } from '../errors.js';
import { User, type UserDoc, type UserRole } from '../models/user.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  let userId: string;
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

export const requireRole =
  (role: UserRole): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.role !== role) {
      throw new HttpError(403, 'You do not have access to this resource');
    }
    next();
  };

export function currentUser(req: Request): UserDoc {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }
  return req.user;
}
