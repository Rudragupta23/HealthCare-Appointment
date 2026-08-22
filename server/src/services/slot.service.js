import Appointment from '../models/Appointment.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { zonedToUtc, dateKey, weekdayIndex, minutesOfDay, toTimeStr, addMinutes } from '../utils/time.js';

const OCCUPIED = ['held', 'booked', 'completed'];

/** Held slots that were never confirmed stop blocking the calendar. */
export async function releaseExpiredHolds(filter = {}) {
  const res = await Appointment.deleteMany({ status: 'held', holdExpiresAt: { $lt: new Date() }, ...filter });
  return res.deletedCount;
}

/**
 * All slots a doctor works on a given date, each marked available or not.
 * A doctor on leave returns an empty list with a reason.
 */
export async function getSlotsForDate(doctorProfile, dateStr) {
  if (doctorProfile.isOnLeave(dateStr)) {
    const leave = doctorProfile.leaveDays.find((l) => l.date === dateStr);
    return { date: dateStr, onLeave: true, reason: leave?.reason || 'Unavailable', slots: [] };
  }

  await releaseExpiredHolds({ doctor: doctorProfile.user });

  // Weekday of that date in clinic time (midday avoids any DST edge).
  const probe = zonedToUtc(dateStr, '12:00');
  const dow = weekdayIndex(probe);
  const windows = doctorProfile.workingHours.filter((w) => w.dayOfWeek === dow);
  if (!windows.length) return { date: dateStr, onLeave: false, reason: 'Doctor does not work on this day', slots: [] };

  const taken = await Appointment.find({
    doctor: doctorProfile.user,
    dateKey: dateStr,
    status: { $in: OCCUPIED },
  }).select('startTime status').lean();
  const takenSet = new Set(taken.map((a) => a.startTime.getTime()));

  const duration = doctorProfile.slotDurationMinutes;
  const now = new Date();
  const slots = [];

  for (const w of windows) {
    for (let m = minutesOfDay(w.startTime); m + duration <= minutesOfDay(w.endTime); m += duration) {
      const start = zonedToUtc(dateStr, toTimeStr(m));
      slots.push({
        startTime: start.toISOString(),
        endTime: addMinutes(start, duration).toISOString(),
        label: toTimeStr(m),
        available: !takenSet.has(start.getTime()) && start > now,
        reason: takenSet.has(start.getTime()) ? 'booked' : start <= now ? 'past' : null,
      });
    }
  }

  slots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return { date: dateStr, onLeave: false, reason: null, slots };
}

/** Rejects anything outside the doctor's published schedule. */
export function assertSlotIsValid(doctorProfile, startTime) {
  const dStr = dateKey(startTime);
  if (doctorProfile.isOnLeave(dStr)) throw ApiError.conflict('The doctor is on leave that day', 'DOCTOR_ON_LEAVE');
  if (startTime <= new Date()) throw ApiError.badRequest('That time is in the past');

  const dow = weekdayIndex(startTime);
  const duration = doctorProfile.slotDurationMinutes;
  const windows = doctorProfile.workingHours.filter((w) => w.dayOfWeek === dow);
  if (!windows.length) throw ApiError.conflict('The doctor does not consult on that day', 'OUTSIDE_WORKING_HOURS');

  const startMinutes = Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hour12: false }).format(startTime)) * 60
    + Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, minute: '2-digit' }).format(startTime));

  const fits = windows.some((w) => {
    const open = minutesOfDay(w.startTime);
    const close = minutesOfDay(w.endTime);
    return startMinutes >= open && startMinutes + duration <= close && (startMinutes - open) % duration === 0;
  });
  if (!fits) throw ApiError.conflict('That is not a bookable slot for this doctor', 'INVALID_SLOT');

  return { dateKey: dStr, endTime: addMinutes(startTime, duration) };
}

/**
 * Places a temporary hold. The unique partial index on
 * (doctor, startTime, slotActive) makes two simultaneous requests impossible
 * to both succeed - the loser gets a duplicate-key error, which we translate
 * into a clean 409 so the UI can refresh the grid.
 */
export async function holdSlot({ doctorProfile, patientId, startTime }) {
  const { dateKey: dStr, endTime } = assertSlotIsValid(doctorProfile, startTime);
  await releaseExpiredHolds({ doctor: doctorProfile.user });

  try {
    return await Appointment.create({
      doctor: doctorProfile.user,
      doctorProfile: doctorProfile._id,
      patient: patientId,
      startTime,
      endTime,
      dateKey: dStr,
      status: 'held',
      slotActive: true,
      holdExpiresAt: addMinutes(new Date(), config.slotHoldMinutes),
    });
  } catch (err) {
    if (err.code === 11000) {
      const onPatient = String(err.message).includes('uniq_active_patient_slot');
      throw ApiError.conflict(
        onPatient
          ? 'You already have an appointment at that time'
          : 'Someone just took that slot. Pick another one.',
        onPatient ? 'PATIENT_DOUBLE_BOOKED' : 'SLOT_TAKEN'
      );
    }
    throw err;
  }
}
