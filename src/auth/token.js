import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(userId) {
  return jwt.sign({}, config.JWT_SECRET, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Token has no subject');
  }
  return payload.sub;
}
