import crypto from 'node:crypto';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Appointment from '../models/Appointment.js';
import EmailJob from '../models/EmailJob.js';
import MedicationReminder from '../models/MedicationReminder.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';
import { validateWorkingHours } from './doctor.controller.js';
import { queueEmail, templates, processEmailQueue } from '../services/email.service.js';
import { config } from '../config/env.js';

export const createDoctor = asyncHandler(async (req, res) => {
  const {
    name, email, password, phone, specialisation, qualification, experienceYears,
    consultationFee, room, bio, slotDurationMinutes, workingHours,
  } = req.body;

  if (!name || !email || !specialisation) throw ApiError.badRequest('Name, email and specialisation are required');
  if (await User.findOne({ email: String(email).toLowerCase() })) throw ApiError.conflict('That email is already registered');

  const tempPassword = password || `Dr${crypto.randomBytes(4).toString('hex')}!`;
  const user = new User({ name, email, role: 'doctor', phone });
  await user.setPassword(tempPassword);
  await user.save();

  validateWorkingHours(workingHours || []);
  const profile = await DoctorProfile.create({
    user: user._id,
    specialisation,
    qualification: qualification || '',
    experienceYears: experienceYears || 0,
    consultationFee: consultationFee || 0,
    room: room || '',
    bio: bio || '',
    slotDurationMinutes: slotDurationMinutes || 30,
    workingHours: workingHours || defaultHours(),
  });

  await queueEmail({
    to: user.email,
    ...templates.doctorWelcome({ name: user.name, email: user.email, password: tempPassword, loginUrl: `${config.clientUrl}/login` }),
    type: 'doctor_welcome',
  });

  res.status(201).json({
    message: `${name} can now sign in. Their temporary password has been emailed.`,
    doctor: { user: user.toSafeJSON(), profile },
    temporaryPassword: tempPassword,
  });
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.params.id }).populate('user');
  if (!profile) throw ApiError.notFound('Doctor not found');

  const profileFields = ['specialisation', 'qualification', 'experienceYears', 'consultationFee', 'room', 'bio', 'slotDurationMinutes', 'workingHours', 'isAcceptingPatients'];
  for (const key of profileFields) if (req.body[key] !== undefined) profile[key] = req.body[key];
  validateWorkingHours(profile.workingHours);
  await profile.save();

  for (const key of ['name', 'phone', 'isActive']) if (req.body[key] !== undefined) profile.user[key] = req.body[key];
  await profile.user.save();

  res.json({ message: 'Doctor profile updated', doctor: profile });
});

export const deactivateDoctor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'doctor') throw ApiError.notFound('Doctor not found');
  user.isActive = false;
  await user.save();
  await DoctorProfile.updateOne({ user: user._id }, { $set: { isAcceptingPatients: false } });
  const future = await Appointment.countDocuments({ doctor: user._id, status: 'booked', startTime: { $gte: new Date() } });
  res.json({ message: `${user.name} can no longer sign in or take new bookings.`, upcomingAppointmentsStillOpen: future });
});

export const listUsers = asyncHandler(async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).select('-passwordHash -google.refreshToken -google.accessToken').sort({ createdAt: -1 }).limit(500);
  res.json({ users });
});

export const listAllAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.date) filter.dateKey = req.query.date;
  const appointments = await Appointment.find(filter)
    .populate([{ path: 'patient', select: 'name email' }, { path: 'doctor', select: 'name email' }, { path: 'doctorProfile', select: 'specialisation' }])
    .sort({ startTime: -1 })
    .limit(300);
  res.json({ appointments });
});

export const dashboard = asyncHandler(async (_req, res) => {
  const [patients, doctors, byStatus, emailStats, pendingReminders, llmFallbacks] = await Promise.all([
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'doctor', isActive: true }),
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    EmailJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    MedicationReminder.countDocuments({ status: 'pending' }),
    Appointment.countDocuments({ 'preVisitSummary.source': 'fallback' }),
  ]);

  res.json({
    patients,
    doctors,
    appointments: byStatus.reduce((a, r) => ({ ...a, [r._id]: r.count }), {}),
    emails: emailStats.reduce((a, r) => ({ ...a, [r._id]: r.count }), {}),
    pendingReminders,
    llmFallbacks,
  });
});

/** Operational view: which notifications failed and why. */
export const listEmailJobs = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const jobs = await EmailJob.find(filter).select('-html').sort({ createdAt: -1 }).limit(200);
  res.json({ jobs });
});

export const retryEmailJob = asyncHandler(async (req, res) => {
  const job = await EmailJob.findById(req.params.id);
  if (!job) throw ApiError.notFound('Email job not found');
  job.status = 'pending';
  job.attempts = 0;
  job.nextAttemptAt = new Date();
  await job.save();
  const result = await processEmailQueue(5);
  res.json({ message: 'Retried', result });
});

function defaultHours() {
  return [1, 2, 3, 4, 5].flatMap((d) => [
    { dayOfWeek: d, startTime: '09:00', endTime: '13:00' },
    { dayOfWeek: d, startTime: '14:00', endTime: '17:00' },
  ]);
}
