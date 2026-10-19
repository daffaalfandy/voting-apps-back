export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function isDuplicateKeyError(err) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
