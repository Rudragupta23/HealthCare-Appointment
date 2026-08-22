import { google } from 'googleapis';
import { config } from '../config/env.js';
import User from '../models/User.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email'];

export function isCalendarConfigured() {
  return Boolean(config.google.enabled && config.google.clientId && config.google.clientSecret);
}

export function oauthClient() {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUri);
}

/** Consent URL. `state` carries the user id so the callback knows who connected. */
export function buildAuthUrl(userId) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces a refresh_token even on re-connect
    scope: SCOPES,
    state: String(userId),
  });
}

export async function exchangeCodeAndStore(code, userId) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found for calendar connection');

  user.google = {
    refreshToken: tokens.refresh_token || user.google?.refreshToken || null,
    accessToken: tokens.access_token || null,
    expiryDate: tokens.expiry_date || null,
    email: user.google?.email || null,
    connectedAt: new Date(),
  };

  try {
    client.setCredentials(tokens);
    const info = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
    user.google.email = info.data.email;
  } catch { /* email lookup is cosmetic */ }

  await user.save();
  return user;
}

/** Authorised calendar client for a user, or null if they never connected. */
async function calendarFor(user) {
  if (!isCalendarConfigured() || !user?.google?.refreshToken) return null;
  const client = oauthClient();
  client.setCredentials({
    refresh_token: user.google.refreshToken,
    access_token: user.google.accessToken || undefined,
    expiry_date: user.google.expiryDate || undefined,
  });
  return google.calendar({ version: 'v3', auth: client });
}

function eventBody({ summary, description, start, end, attendees }) {
  return {
    summary,
    description,
    start: { dateTime: start.toISOString(), timeZone: config.timezone },
    end: { dateTime: end.toISOString(), timeZone: config.timezone },
    attendees,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 10 }] },
  };
}

/**
 * Creates the event on both calendars. Calendar problems are logged and
 * reported, never thrown - a failed calendar sync must not undo a booking.
 */
export async function createAppointmentEvents({ appointment, patient, doctor, doctorProfile }) {
  const result = { patientEventId: null, doctorEventId: null, status: 'none', lastError: '' };
  if (!isCalendarConfigured()) return result;

  const start = appointment.startTime;
  const end = appointment.endTime;
  const attendees = [{ email: patient.email }, { email: doctor.email }];

  const targets = [
    { user: patient, key: 'patientEventId', summary: `Appointment with ${doctor.name} (${doctorProfile.specialisation})`, description: `Consultation booked through City Clinic.\nPatient: ${patient.name}` },
    { user: doctor, key: 'doctorEventId', summary: `Consultation: ${patient.name}`, description: `Patient: ${patient.name}\nBooked through City Clinic.` },
  ];

  for (const t of targets) {
    try {
      const cal = await calendarFor(t.user);
      if (!cal) continue;
      const res = await cal.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all',
        requestBody: eventBody({ summary: t.summary, description: t.description, start, end, attendees }),
      });
      result[t.key] = res.data.id;
    } catch (err) {
      result.lastError = err.message;
      console.warn(`[calendar] create failed for ${t.user.email}: ${err.message}`);
    }
  }

  const made = [result.patientEventId, result.doctorEventId].filter(Boolean).length;
  result.status = made === 2 ? 'created' : made === 1 ? 'partial' : result.lastError ? 'failed' : 'none';
  return result;
}

export async function updateAppointmentEvents({ appointment, patient, doctor }) {
  if (!isCalendarConfigured()) return appointment.calendar;
  const pairs = [
    { user: patient, id: appointment.calendar?.patientEventId },
    { user: doctor, id: appointment.calendar?.doctorEventId },
  ];
  for (const p of pairs) {
    if (!p.id) continue;
    try {
      const cal = await calendarFor(p.user);
      if (!cal) continue;
      await cal.events.patch({
        calendarId: 'primary',
        eventId: p.id,
        sendUpdates: 'all',
        requestBody: {
          start: { dateTime: appointment.startTime.toISOString(), timeZone: config.timezone },
          end: { dateTime: appointment.endTime.toISOString(), timeZone: config.timezone },
        },
      });
    } catch (err) {
      console.warn(`[calendar] update failed for ${p.user.email}: ${err.message}`);
    }
  }
  return appointment.calendar;
}

export async function deleteAppointmentEvents({ appointment, patient, doctor }) {
  if (!isCalendarConfigured()) return;
  const pairs = [
    { user: patient, id: appointment.calendar?.patientEventId },
    { user: doctor, id: appointment.calendar?.doctorEventId },
  ];
  for (const p of pairs) {
    if (!p.id) continue;
    try {
      const cal = await calendarFor(p.user);
      if (!cal) continue;
      await cal.events.delete({ calendarId: 'primary', eventId: p.id, sendUpdates: 'all' });
    } catch (err) {
      // 404/410 just means the user already removed it
      console.warn(`[calendar] delete skipped for ${p.user.email}: ${err.message}`);
    }
  }
}
