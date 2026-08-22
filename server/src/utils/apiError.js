export class ApiError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
  }
  static badRequest(msg, code) { return new ApiError(400, msg, code); }
  static unauthorised(msg = 'Sign in to continue') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have access to this') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg, code) { return new ApiError(409, msg, code); }
}

/** Wraps async route handlers so thrown errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
