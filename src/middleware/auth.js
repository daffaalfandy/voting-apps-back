import { AuthenticationError, ForbiddenError } from '../errors.js';
import * as authService from '../services/auth.js';

export const requireAuth = async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  req.user = await authService.authenticate(token);
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
