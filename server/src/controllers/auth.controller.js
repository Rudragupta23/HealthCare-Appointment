import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import { signToken } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, gender, dateOfBirth } = req.body;

  if (!name || !email || !password) throw ApiError.badRequest('Name, email and password are required');
  if (!EMAIL_RE.test(email)) throw ApiError.badRequest('Enter a valid email address');
  if (String(password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with that email already exists');

  // Self-registration is patients only. Doctors are created by an admin.
  const user = new User({ name, email, role: 'patient', phone, gender, dateOfBirth });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('Enter your email and password');

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await user.verifyPassword(password))) throw ApiError.unauthorised('Email or password is incorrect');
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  const payload = { user: req.user.toSafeJSON() };
  if (req.user.role === 'doctor') {
    payload.doctorProfile = await DoctorProfile.findOne({ user: req.user._id });
  }
  res.json(payload);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, gender, dateOfBirth } = req.body;
  const user = req.user;
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (gender) user.gender = gender;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;
  await user.save();
  res.json({ user: user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!(await req.user.verifyPassword(currentPassword || ''))) throw ApiError.badRequest('Current password is incorrect');
  if (String(newPassword || '').length < 8) throw ApiError.badRequest('New password must be at least 8 characters');
  await req.user.setPassword(newPassword);
  await req.user.save();
  res.json({ message: 'Password changed' });
});
