import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AuthenticationError, ConflictError, ForbiddenError, LockedError, NotFoundError, ValidationError } from '../errors.js';

const STATUS_BY_ERROR = [
  [ValidationError, 400],
  [AuthenticationError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [LockedError, 423],
];

export const notFound = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

export const errorHandler = (err, _req, res, _next) => {
  const status = STATUS_BY_ERROR.find(([type]) => err instanceof type)?.[1];
  if (status) {
    res.status(status).json({ error: { message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    res.status(400).json({ error: { message: 'Validation failed', details } });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { message: `Invalid ${err.path}` } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Malformed JSON body' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};
