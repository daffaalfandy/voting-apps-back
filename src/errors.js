export class AppError extends Error {
  constructor(message, details) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {}

export class AuthenticationError extends AppError {}

export class ForbiddenError extends AppError {}

export class NotFoundError extends AppError {}

export class ConflictError extends AppError {}

export class LockedError extends AppError {}

export class DuplicateError extends ConflictError {
  constructor() {
    super('This record already exists');
  }
}

export function isDuplicateKeyError(err) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
