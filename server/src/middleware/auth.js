import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorised();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw ApiError.unauthorised('Your session has expired. Sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorised('Account not found or disabled');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorised());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`This area is for ${roles.join(' / ')} accounts`));
  next();
};
