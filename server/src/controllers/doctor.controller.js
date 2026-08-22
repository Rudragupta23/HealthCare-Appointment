import DoctorProfile from '../models/DoctorProfile.js';
import Appointment from '../models/Appointment.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';
import { getSlotsForDate } from '../services/slot.service.js';
import { cancelDayForDoctor } from '../services/appointment.service.js';
import { dateKey } from '../utils/time.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Public directory: search by name or specialisation. */
export const listDoctors = asyncHandler(async (req, res) => {
  const { specialisation, q } = req.query;
  const filter = {};
  if (specialisation && specialisation !== 'all') filter.specialisation = new RegExp(`^${escapeRe(specialisation)}$`, 'i');

  let profiles = await DoctorProfile.find(filter).populate({ path: 'user', select: 'name email isActive' }).lean();
  profiles = profiles.filter((p) => p.user?.isActive);

  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    profiles = profiles.filter((p) => re.test(p.user.name) || re.test(p.specialisation) || re.test(p.qualification || ''));
  }

  res.json({ doctors: profiles });
});

export const listSpecialisations = asyncHandler(async (_req, res) => {
  const values = await DoctorProfile.distinct('specialisation');
  res.json({ specialisations: values.sort() });
});

export const getDoctor = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.params.id }).populate({ path: 'user', select: 'name email' });
  if (!profile) throw ApiError.notFound('Doctor not found');
  res.json({ doctor: profile });
});

/** Slot grid for one date. */
export const availability = asyncHandler(async (req, res) => {
  const date = req.query.date || dateKey(new Date());
  if (!DATE_RE.test(date)) throw ApiError.badRequest('Use a date in YYYY-MM-DD format');

  const profile = await DoctorProfile.findOne({ user: req.params.id });
  if (!profile) throw ApiError.notFound('Doctor not found');

  const result = await getSlotsForDate(profile, date);
  res.json({ doctorId: req.params.id, slotDurationMinutes: profile.slotDurationMinutes, ...result });
});

/* --------------------- the doctor's own dashboard --------------------- */

export const mySchedule = asyncHandler(async (req, res) => {
  const date = req.query.date || dateKey(new Date());
  const appointments = await Appointment.find({ doctor: req.user._id, dateKey: date, status: { $ne: 'cancelled' } })
    .populate({ path: 'patient', select: 'name email phone gender dateOfBirth' })
    .sort({ startTime: 1 });
  res.json({ date, appointments });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id });
  if (!profile) throw ApiError.notFound('You do not have a doctor profile yet');

  const editable = ['qualification', 'experienceYears', 'consultationFee', 'room', 'bio', 'slotDurationMinutes', 'workingHours', 'isAcceptingPatients'];
  for (const key of editable) if (req.body[key] !== undefined) profile[key] = req.body[key];
  validateWorkingHours(profile.workingHours);
  await profile.save();
  res.json({ doctorProfile: profile });
});

/**
 * Marking leave is destructive on purpose: every existing booking that day is
 * cancelled and each patient is emailed, and their calendar entry is removed.
 */
export const addLeave = asyncHandler(async (req, res) => {
  const { date, reason } = req.body;
  if (!DATE_RE.test(date || '')) throw ApiError.badRequest('Use a date in YYYY-MM-DD format');

  const doctorUserId = req.user.role === 'admin' ? req.params.id : req.user._id;
  const profile = await DoctorProfile.findOne({ user: doctorUserId });
  if (!profile) throw ApiError.notFound('Doctor not found');

  if (!profile.isOnLeave(date)) {
    profile.leaveDays.push({ date, reason: reason || 'Unavailable' });
    await profile.save();
  }

  const cancelled = await cancelDayForDoctor(doctorUserId, date, reason);

  res.json({
    message: cancelled
      ? `${date} marked as leave. ${cancelled} appointment(s) cancelled and those patients have been emailed.`
      : `${date} marked as leave. No appointments were affected.`,
    cancelledCount: cancelled,
    doctorProfile: profile,
  });
});

export const removeLeave = asyncHandler(async (req, res) => {
  const { date } = req.body;
  const doctorUserId = req.user.role === 'admin' ? req.params.id : req.user._id;
  const profile = await DoctorProfile.findOne({ user: doctorUserId });
  if (!profile) throw ApiError.notFound('Doctor not found');

  profile.leaveDays = profile.leaveDays.filter((l) => l.date !== date);
  await profile.save();
  res.json({ message: `${date} is bookable again. Cancelled appointments are not restored automatically.`, doctorProfile: profile });
});

/* ------------------------------ helpers ------------------------------ */

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateWorkingHours(windows = []) {
  for (const w of windows) {
    if (w.dayOfWeek < 0 || w.dayOfWeek > 6) throw ApiError.badRequest('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    if (!/^\d{2}:\d{2}$/.test(w.startTime) || !/^\d{2}:\d{2}$/.test(w.endTime)) throw ApiError.badRequest('Working hours must look like 09:00');
    if (w.startTime >= w.endTime) throw ApiError.badRequest('A working window must end after it starts');
  }
}
