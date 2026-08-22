import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import MedicationReminder from '../models/MedicationReminder.js';
import { processEmailQueue, queueEmail, templates } from '../services/email.service.js';
import { releaseExpiredHolds } from '../services/slot.service.js';
import { config } from '../config/env.js';
import { humanTime } from '../utils/time.js';

/** Emails patients (and doctors) shortly before an appointment. */
async function sendAppointmentReminders() {
  const now = new Date();
  const until = new Date(now.getTime() + config.reminderLeadMinutes * 60000);

  const due = await Appointment.find({
    status: 'booked',
    reminderSent: false,
    startTime: { $gt: now, $lte: until },
  }).populate([{ path: 'patient', select: 'name email' }, { path: 'doctor', select: 'name email' }]);

  for (const appt of due) {
    const when = humanTime(appt.startTime);
    const minutes = Math.max(1, Math.round((appt.startTime - now) / 60000));
    await queueEmail({ to: appt.patient.email, ...templates.reminder({ name: appt.patient.name, doctorName: appt.doctor.name, when, minutes }), type: 'reminder', relatedAppointment: appt._id });
    await queueEmail({ to: appt.doctor.email, ...templates.reminder({ name: appt.doctor.name, doctorName: appt.doctor.name, when, minutes }), type: 'reminder', relatedAppointment: appt._id });
    appt.reminderSent = true;
    await appt.save();
  }
  return due.length;
}

/** Turns due medication rows into emails. */
async function sendMedicationReminders() {
  const due = await MedicationReminder.find({ status: 'pending', scheduledAt: { $lte: new Date() } })
    .populate({ path: 'patient', select: 'name email' })
    .limit(200);

  for (const rem of due) {
    if (!rem.patient) { rem.status = 'cancelled'; await rem.save(); continue; }
    await queueEmail({
      to: rem.patient.email,
      ...templates.medicationReminder({ name: rem.patient.name, medicine: rem.medicine, dosage: rem.dosage, instructions: rem.instructions }),
      type: 'medication_reminder',
      relatedAppointment: rem.appointment,
    });
    rem.status = 'sent';
    rem.sentAt = new Date();
    await rem.save();
  }
  return due.length;
}

const guard = (name, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[job:${name}]`, err.message);
  }
};

export function startJobs() {
  if (!config.enableJobs) {
    console.log('  background jobs disabled (ENABLE_JOBS=false)');
    return;
  }

  // every minute: deliver queued mail and retry failures
  cron.schedule('* * * * *', guard('email-queue', processEmailQueue));
  // every minute: medication doses that are now due
  cron.schedule('* * * * *', guard('medication', sendMedicationReminders));
  // every 5 minutes: appointment reminders
  cron.schedule('*/5 * * * *', guard('appointment-reminders', sendAppointmentReminders));
  // every 2 minutes: free slots whose hold expired
  cron.schedule('*/2 * * * *', guard('release-holds', releaseExpiredHolds));

  console.log('  background jobs started (email queue, medication, reminders, hold sweeper)');
}

export const _jobs = { sendAppointmentReminders, sendMedicationReminders };
