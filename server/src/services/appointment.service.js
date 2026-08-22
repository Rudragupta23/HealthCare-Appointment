import Appointment from '../models/Appointment.js';
import MedicationReminder from '../models/MedicationReminder.js';
import { queueEmail, templates } from './email.service.js';
import { deleteAppointmentEvents } from './calendar.service.js';
import { humanTime } from '../utils/time.js';

/**
 * Single cancellation path used by patients, doctors, admins and the
 * doctor-leave sweep, so notifications and calendar cleanup can never diverge.
 */
export async function cancelAppointment(appointment, { by, reason = '', byDoctorLeave = false }) {
  await appointment.populate([
    { path: 'patient', select: 'name email google' },
    { path: 'doctor', select: 'name email google' },
    { path: 'doctorProfile', select: 'specialisation' },
  ]);

  const when = humanTime(appointment.startTime);

  try {
    await deleteAppointmentEvents({ appointment, patient: appointment.patient, doctor: appointment.doctor });
    appointment.calendar.status = 'deleted';
  } catch (err) {
    appointment.calendar.lastError = err.message;
  }

  appointment.status = 'cancelled';
  appointment.cancelledBy = by;
  appointment.cancellationReason = reason;
  appointment.slotActive = undefined; // frees the slot in the unique index
  appointment.holdExpiresAt = null;
  await appointment.save();

  await MedicationReminder.updateMany(
    { appointment: appointment._id, status: 'pending' },
    { $set: { status: 'cancelled' } }
  );

  const patientMail = templates.cancellation({
    name: appointment.patient.name, doctorName: appointment.doctor.name, when, reason, byDoctorLeave,
  });
  await queueEmail({ to: appointment.patient.email, ...patientMail, type: 'cancellation', relatedAppointment: appointment._id });

  const doctorMail = templates.cancellation({
    name: appointment.doctor.name, doctorName: appointment.doctor.name, when, reason, byDoctorLeave: false,
  });
  await queueEmail({ to: appointment.doctor.email, ...doctorMail, type: 'cancellation', relatedAppointment: appointment._id });

  return appointment;
}

/** Cancels and notifies everyone affected when a doctor takes a day off. */
export async function cancelDayForDoctor(doctorUserId, dateStr, reason) {
  const affected = await Appointment.find({
    doctor: doctorUserId,
    dateKey: dateStr,
    status: { $in: ['held', 'booked'] },
  });

  for (const appt of affected) {
    await cancelAppointment(appt, {
      by: 'doctor',
      reason: reason || 'The doctor is unavailable on this date',
      byDoctorLeave: true,
    });
  }
  return affected.length;
}

/** Builds the reminder rows for a prescription, spread over the day. */
export function buildMedicationReminders(appointment, prescriptions) {
  // Even spread inside a 12-hour waking window starting the next morning-ish.
  const WINDOW_START_HOUR = 8;
  const WINDOW_HOURS = 12;
  const rows = [];
  const base = new Date(appointment.startTime);

  for (const p of prescriptions) {
    const gap = WINDOW_HOURS / p.timesPerDay;
    for (let day = 0; day < p.durationDays; day += 1) {
      for (let dose = 0; dose < p.timesPerDay; dose += 1) {
        const at = new Date(base);
        at.setDate(at.getDate() + day);
        at.setHours(WINDOW_START_HOUR + Math.round(gap * dose), 0, 0, 0);
        if (at <= new Date()) continue; // never schedule a dose in the past
        rows.push({
          appointment: appointment._id,
          patient: appointment.patient._id || appointment.patient,
          medicine: p.medicine,
          dosage: p.dosage,
          instructions: p.instructions,
          scheduledAt: at,
        });
      }
    }
  }
  return rows;
}
