import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import EmailJob from '../models/EmailJob.js';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { host, port, secure, user, pass } = config.email.smtp;
  transporter = nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
  return transporter;
}

/** Queue an email. Nothing is sent inline, so a slow mail server never blocks a booking. */
export async function queueEmail({ to, subject, html, text, type = 'generic', relatedAppointment = null }) {
  if (!to) return null;
  return EmailJob.create({
    to, subject, html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    type, relatedAppointment,
  });
}

/** Actually deliver one message through the configured provider. */
async function deliver(job) {
  const { provider, from, sendgridKey } = config.email;

  if (provider === 'console') {
    console.log('\n----- EMAIL (console provider) -----');
    console.log(`to      : ${job.to}`);
    console.log(`subject : ${job.subject}`);
    console.log(job.text);
    console.log('------------------------------------\n');
    return;
  }

  if (provider === 'sendgrid') {
    if (!sendgridKey) throw new Error('SENDGRID_API_KEY is not set');
    const match = from.match(/<(.+)>/);
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sendgridKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: job.to }] }],
        from: { email: match ? match[1] : from, name: from.split('<')[0].trim() || undefined },
        subject: job.subject,
        content: [{ type: 'text/html', value: job.html }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }

  // default: SMTP (Gmail, Mailtrap, Mailgun SMTP, ...)
  if (!config.email.smtp.host) throw new Error('SMTP_HOST is not set');
  await getTransporter().sendMail({ from, to: job.to, subject: job.subject, html: job.html, text: job.text });
}

/**
 * Worker pass: send everything due, retry failures with exponential backoff
 * (1m, 2m, 4m, 8m, 16m) and give up after EMAIL_MAX_ATTEMPTS.
 */
export async function processEmailQueue(limit = 25) {
  const now = new Date();
  const jobs = await EmailJob.find({ status: 'pending', nextAttemptAt: { $lte: now } })
    .sort({ nextAttemptAt: 1 })
    .limit(limit);

  let sent = 0;
  for (const job of jobs) {
    job.attempts += 1;
    try {
      await deliver(job);
      job.status = 'sent';
      job.sentAt = new Date();
      job.lastError = '';
      sent += 1;
    } catch (err) {
      job.lastError = err.message;
      if (job.attempts >= config.email.maxAttempts) {
        job.status = 'failed';
        console.error(`[email] permanently failed after ${job.attempts} attempts -> ${job.to}: ${err.message}`);
      } else {
        job.nextAttemptAt = new Date(Date.now() + 60000 * 2 ** (job.attempts - 1));
        console.warn(`[email] attempt ${job.attempts} failed, retrying later -> ${job.to}: ${err.message}`);
      }
    }
    await job.save();
  }
  return { processed: jobs.length, sent };
}

/* ---------------------------- templates ---------------------------- */

const shell = (title, body) => `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef2f1;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #d3ddda">
    <div style="background:#0e6e63;color:#fff;padding:18px 24px;font-size:18px;font-weight:600">${title}</div>
    <div style="padding:24px;color:#12211f;font-size:15px;line-height:1.6">${body}</div>
    <div style="padding:14px 24px;background:#f6f8f8;color:#5b6b68;font-size:12px">
      City Clinic - this mailbox is not monitored. Manage your appointments at
      <a href="${config.clientUrl}" style="color:#0e6e63">${config.clientUrl}</a>
    </div>
  </div>
</div>`;

const row = (label, value) => `<tr><td style="padding:4px 12px 4px 0;color:#5b6b68">${label}</td><td style="padding:4px 0;font-weight:600">${value}</td></tr>`;

export const templates = {
  bookingConfirmation: ({ patientName, doctorName, specialisation, when, isDoctor }) => ({
    subject: isDoctor ? `New appointment: ${patientName} - ${when}` : `Appointment confirmed - ${when}`,
    html: shell(
      isDoctor ? 'New appointment booked' : 'Your appointment is confirmed',
      `<p>Hi ${isDoctor ? doctorName : patientName},</p>
       <p>${isDoctor ? 'A patient has booked a slot with you.' : 'Your appointment has been confirmed.'}</p>
       <table style="font-size:15px">
         ${row('Doctor', `${doctorName} (${specialisation})`)}
         ${row('Patient', patientName)}
         ${row('When', when)}
       </table>
       <p style="margin-top:18px">${isDoctor ? 'The AI pre-visit summary is on your dashboard.' : 'Please arrive 10 minutes early.'}</p>`
    ),
  }),

  reminder: ({ name, doctorName, when, minutes }) => ({
    subject: `Reminder: appointment in ${minutes} minutes - ${when}`,
    html: shell('Appointment reminder', `<p>Hi ${name},</p><p>This is a reminder about your appointment with ${doctorName} at <strong>${when}</strong>.</p>`),
  }),

  cancellation: ({ name, doctorName, when, reason, byDoctorLeave }) => ({
    subject: byDoctorLeave ? `Appointment cancelled - ${doctorName} is unavailable` : `Appointment cancelled - ${when}`,
    html: shell(
      'Appointment cancelled',
      `<p>Hi ${name},</p>
       <p>The appointment with ${doctorName} on <strong>${when}</strong> has been cancelled.</p>
       ${reason ? `<p>Reason: ${reason}</p>` : ''}
       ${byDoctorLeave ? '<p>We are sorry for the short notice. You can book another slot from your dashboard, and any calendar entry has been removed.</p>' : ''}`
    ),
  }),

  rescheduled: ({ name, doctorName, oldWhen, newWhen }) => ({
    subject: `Appointment moved to ${newWhen}`,
    html: shell('Appointment rescheduled', `<p>Hi ${name},</p><p>Your appointment with ${doctorName} has moved from <strong>${oldWhen}</strong> to <strong>${newWhen}</strong>. Calendar entries have been updated.</p>`),
  }),

  postVisit: ({ name, doctorName, summary, schedule, steps }) => ({
    subject: 'Your visit summary and medication plan',
    html: shell(
      'After your visit',
      `<p>Hi ${name},</p>
       <p>${doctorName} has completed your consultation notes. Here is the plain-language summary.</p>
       <div style="white-space:pre-wrap;background:#f6f8f8;border-left:3px solid #0e6e63;padding:12px 14px;border-radius:6px">${summary}</div>
       <h3 style="margin:20px 0 6px">Medication</h3>
       <div style="white-space:pre-wrap">${schedule}</div>
       ${steps?.length ? `<h3 style="margin:20px 0 6px">Next steps</h3><ul>${steps.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''}`
    ),
  }),

  medicationReminder: ({ name, medicine, dosage, instructions }) => ({
    subject: `Time for your ${medicine}`,
    html: shell('Medication reminder', `<p>Hi ${name},</p><p>It is time to take <strong>${medicine}</strong>${dosage ? ` (${dosage})` : ''}.</p>${instructions ? `<p>${instructions}</p>` : ''}`),
  }),

  doctorWelcome: ({ name, email, password, loginUrl }) => ({
    subject: 'Your doctor account is ready',
    html: shell('Welcome to City Clinic', `<p>Hi ${name},</p><p>An account has been created for you.</p><table style="font-size:15px">${row('Email', email)}${row('Temporary password', password)}</table><p><a href="${loginUrl}" style="display:inline-block;margin-top:14px;background:#0e6e63;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a></p>`),
  }),
};
