import { config } from '../config/env.js';

const TZ = config.timezone;

/** Milliseconds that the timezone is ahead of UTC at the given instant. */
function offsetMs(date, timeZone = TZ) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** "2026-09-14" + "09:30" (clinic-local) -> real UTC Date */
export function zonedToUtc(dateStr, timeStr, timeZone = TZ) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min, 0);
  let result = new Date(guess - offsetMs(new Date(guess), timeZone));
  // one refinement pass handles DST boundaries
  result = new Date(guess - offsetMs(result, timeZone));
  return result;
}

/** Date -> "2026-09-14" in clinic time */
export function dateKey(date, timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Date -> 0 (Sun) .. 6 (Sat) in clinic time */
export function weekdayIndex(date, timeZone = TZ) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

/** Date -> "14 Sep 2026, 09:30 AM" in clinic time */
export function humanTime(date, timeZone = TZ) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

/** Date -> "09:30" in clinic time */
export function clockTime(date, timeZone = TZ) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function minutesOfDay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function toTimeStr(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
