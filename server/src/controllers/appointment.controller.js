import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import DoctorProfile from '../models/DoctorProfile.js';
import MedicationReminder from '../models/MedicationReminder.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';
import { holdSlot, assertSlotIsValid, releaseExpiredHolds } from '../services/slot.service.js';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/llm.service.js';
import { queueEmail, templates } from '../services/email.service.js';
import { createAppointmentEvents, updateAppointmentEvents } from '../services/calendar.service.js';
import { cancelAppointment, buildMedicationReminders } from '../services/appointment.service.js';
import { humanTime, addMinutes } from '../utils/time.js';

const POPULATE = [
  { path: 'patient', select: 'name email phone gender dateOfBirth google' },
  { path: 'doctor', select: 'name email google' },
  { path: 'doctorProfile', select: 'specialisation qualification room slotDurationMinutes consultationFee' },
];

function assertParticipant(appointment, user) {
  const isPatient = String(appointment.patient._id || appointment.patient) === String(user._id);
  const isDoctor = String(appointment.doctor._id || appointment.doctor) === String(user._id);
  if (!isPatient && !isDoctor && user.role !== 'admin') throw ApiError.forbidden('This appointment is not yours');
  return { isPatient, isDoctor };
}

/* ------------------------------ booking ------------------------------ */

/** Step 1 of booking: reserve the slot for SLOT_HOLD_MINUTES. */
export const holdAppointment = asyncHandler(async (req, res) => {
  const { doctorId, startTime } = req.body;
  if (!doctorId || !startTime) throw ApiError.badRequest('Choose a doctor and a time slot');

  const profile = await DoctorProfile.findOne({ user: doctorId });
  if (!profile) throw ApiError.notFound('Doctor not found');
  if (!profile.isAcceptingPatients) throw ApiError.conflict('This doctor is not accepting new bookings');

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw ApiError.badRequest('That start time is not a valid date');

  const appointment = await holdSlot({ doctorProfile: profile, patientId: req.user._id, startTime: start });

  res.status(201).json({
    appointment: { id: appointment._id, startTime: appointment.startTime, endTime: appointment.endTime, holdExpiresAt: appointment.holdExpiresAt },
    message: `Slot held until ${humanTime(appointment.holdExpiresAt)}. Complete the symptom form to confirm.`,
  });
});

/** Step 2: symptom form -> LLM pre-visit summary -> confirmed booking. */
export const confirmAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('That held slot no longer exists. Please pick a slot again.');
  if (String(appointment.patient) !== String(req.user._id)) throw ApiError.forbidden('This booking is not yours');
  if (appointment.status !== 'held') throw ApiError.conflict('This appointment is already confirmed');
  if (appointment.holdExpiresAt && appointment.holdExpiresAt < new Date()) {
    await appointment.deleteOne();
    throw ApiError.conflict('Your hold expired and the slot was released. Please pick a slot again.', 'HOLD_EXPIRED');
  }

  const { description, durationOfSymptoms, painLevel, existingConditions, currentMedication, allergies } = req.body;
  if (!description || String(description).trim().length < 10) {
    throw ApiError.badRequest('Describe your symptoms in at least 10 characters so the doctor can prepare');
  }

  appointment.symptomForm = {
    description, durationOfSymptoms, painLevel: Number(painLevel) || 0,
    existingConditions, currentMedication, allergies, submittedAt: new Date(),
  };

  // LLM never blocks the booking: it returns a fallback summary on failure.
  appointment.preVisitSummary = await generatePreVisitSummary(appointment.symptomForm);
  appointment.status = 'booked';
  appointment.holdExpiresAt = null;
  await appointment.save();
  await appointment.populate(POPULATE);

  const calendar = await createAppointmentEvents({
    appointment,
    patient: appointment.patient,
    doctor: appointment.doctor,
    doctorProfile: appointment.doctorProfile,
  });
  appointment.calendar = calendar;
  await appointment.save();

  const when = humanTime(appointment.startTime);
  const base = { patientName: appointment.patient.name, doctorName: appointment.doctor.name, specialisation: appointment.doctorProfile.specialisation, when };
  await queueEmail({ to: appointment.patient.email, ...templates.bookingConfirmation({ ...base, isDoctor: false }), type: 'booking_confirmation', relatedAppointment: appointment._id });
  await queueEmail({ to: appointment.doctor.email, ...templates.bookingConfirmation({ ...base, isDoctor: true }), type: 'booking_confirmation', relatedAppointment: appointment._id });

  res.json({ appointment, message: 'Appointment confirmed. A confirmation email is on its way.' });
});

/* ------------------------------ reading ------------------------------ */

export const listMyAppointments = asyncHandler(async (req, res) => {
  await releaseExpiredHolds();
  const { status, from, to, scope } = req.query;

  const filter = {};
  if (req.user.role === 'patient') filter.patient = req.user._id;
  else if (req.user.role === 'doctor') filter.doctor = req.user._id;
  if (status) filter.status = { $in: String(status).split(',') };
  else filter.status = { $in: ['booked', 'completed', 'cancelled', 'no_show'] };
  if (scope === 'upcoming') filter.startTime = { $gte: new Date() };
  if (scope === 'past') filter.startTime = { $lt: new Date() };
  if (from || to) {
    filter.startTime = filter.startTime || {};
    if (from) filter.startTime.$gte = new Date(from);
    if (to) filter.startTime.$lte = new Date(to);
  }

  const appointments = await Appointment.find(filter).populate(POPULATE).sort({ startTime: scope === 'past' ? -1 : 1 }).limit(200);
  res.json({ appointments });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  assertParticipant(appointment, req.user);

  // Patients never see raw clinical notes - only the plain-language summary.
  const json = appointment.toObject();
  if (req.user.role === 'patient') delete json.postVisit?.clinicalNotes;
  res.json({ appointment: json });
});

/* ---------------------------- changing it ---------------------------- */

export const cancel = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  const { isPatient } = assertParticipant(appointment, req.user);
  if (['cancelled', 'completed'].includes(appointment.status)) throw ApiError.conflict(`This appointment is already ${appointment.status}`);

  await cancelAppointment(appointment, {
    by: req.user.role === 'admin' ? 'admin' : isPatient ? 'patient' : 'doctor',
    reason: req.body.reason || '',
  });
  res.json({ message: 'Appointment cancelled. Everyone has been notified.', appointment });
});

export const reschedule = asyncHandler(async (req, res) => {
  const { startTime } = req.body;
  const appointment = await Appointment.findById(req.params.id).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  assertParticipant(appointment, req.user);
  if (appointment.status !== 'booked') throw ApiError.conflict('Only confirmed appointments can be moved');

  const profile = await DoctorProfile.findById(appointment.doctorProfile._id);
  const newStart = new Date(startTime);
  if (Number.isNaN(newStart.getTime())) throw ApiError.badRequest('That start time is not a valid date');
  const { dateKey: newKey, endTime } = assertSlotIsValid(profile, newStart);

  const oldWhen = humanTime(appointment.startTime);
  const oldStart = appointment.startTime;

  // Free the old slot and claim the new one; the unique index still guards
  // against a competing booking landing on the target slot first.
  appointment.slotActive = undefined;
  await appointment.save();
  try {
    appointment.startTime = newStart;
    appointment.endTime = endTime;
    appointment.dateKey = newKey;
    appointment.slotActive = true;
    appointment.reminderSent = false;
    await appointment.save();
  } catch (err) {
    appointment.startTime = oldStart;
    appointment.slotActive = true;
    await appointment.save();
    if (err.code === 11000) throw ApiError.conflict('Someone just took that slot. Pick another one.', 'SLOT_TAKEN');
    throw err;
  }

  await updateAppointmentEvents({ appointment, patient: appointment.patient, doctor: appointment.doctor });

  const newWhen = humanTime(newStart);
  for (const person of [appointment.patient, appointment.doctor]) {
    await queueEmail({
      to: person.email,
      ...templates.rescheduled({ name: person.name, doctorName: appointment.doctor.name, oldWhen, newWhen }),
      type: 'reschedule',
      relatedAppointment: appointment._id,
    });
  }

  res.json({ message: `Appointment moved to ${newWhen}.`, appointment });
});

/* --------------------------- after the visit -------------------------- */

export const submitPostVisit = asyncHandler(async (req, res) => {
  const { clinicalNotes, diagnosis, prescriptions = [], followUpDate } = req.body;
  if (!clinicalNotes || String(clinicalNotes).trim().length < 10) throw ApiError.badRequest('Add your clinical notes before submitting');

  const appointment = await Appointment.findById(req.params.id).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (String(appointment.doctor._id) !== String(req.user._id)) throw ApiError.forbidden('Only the treating doctor can add notes');
  if (appointment.status === 'cancelled') throw ApiError.conflict('This appointment was cancelled');

  const cleanPrescriptions = prescriptions
    .filter((p) => p && p.medicine)
    .map((p) => ({
      medicine: String(p.medicine).trim(),
      dosage: String(p.dosage || '').trim(),
      timesPerDay: Math.min(6, Math.max(1, Number(p.timesPerDay) || 1)),
      durationDays: Math.min(180, Math.max(1, Number(p.durationDays) || 1)),
      instructions: String(p.instructions || '').trim(),
    }));

  const summary = await generatePostVisitSummary({ clinicalNotes, diagnosis, prescriptions: cleanPrescriptions });

  appointment.prescriptions = cleanPrescriptions;
  appointment.postVisit = { clinicalNotes, diagnosis: diagnosis || '', followUpDate: followUpDate || null, ...summary };
  appointment.status = 'completed';
  await appointment.save();

  // Rebuild the medication schedule for this visit.
  await MedicationReminder.deleteMany({ appointment: appointment._id, status: 'pending' });
  const rows = buildMedicationReminders(appointment, cleanPrescriptions);
  if (rows.length) await MedicationReminder.insertMany(rows);

  await queueEmail({
    to: appointment.patient.email,
    ...templates.postVisit({
      name: appointment.patient.name,
      doctorName: appointment.doctor.name,
      summary: appointment.postVisit.patientSummary,
      schedule: appointment.postVisit.medicationSchedule,
      steps: appointment.postVisit.followUpSteps,
    }),
    type: 'post_visit',
    relatedAppointment: appointment._id,
  });

  res.json({
    message: `Visit closed. ${rows.length} medication reminder(s) scheduled and the summary has been emailed.`,
    appointment,
    remindersScheduled: rows.length,
  });
});

export const markNoShow = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (String(appointment.doctor) !== String(req.user._id) && req.user.role !== 'admin') throw ApiError.forbidden('Only the treating doctor can do this');
  appointment.status = 'no_show';
  await appointment.save();
  res.json({ message: 'Marked as a no-show', appointment });
});

export const myReminders = asyncHandler(async (req, res) => {
  const reminders = await MedicationReminder.find({ patient: req.user._id })
    .sort({ scheduledAt: 1 })
    .limit(300)
    .populate({ path: 'appointment', select: 'startTime doctor', populate: { path: 'doctor', select: 'name' } });
  res.json({ reminders });
});

export const stats = asyncHandler(async (req, res) => {
  const match = req.user.role === 'doctor'
    ? { doctor: new mongoose.Types.ObjectId(req.user._id) }
    : { patient: new mongoose.Types.ObjectId(req.user._id) };

  const rows = await Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = rows.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
  const upcoming = await Appointment.countDocuments({ ...match, status: 'booked', startTime: { $gte: new Date() } });
  res.json({ byStatus, upcoming });
});

export const _addMinutes = addMinutes; // re-exported for tests
