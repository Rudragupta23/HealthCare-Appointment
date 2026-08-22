/**
 * Proves the double-booking guard.
 *
 * Fires N simultaneous hold requests at the SAME slot and asserts that
 * exactly one succeeds. Run it against a running server with seeded data:
 *
 *   npm run seed
 *   npm start           (in another terminal)
 *   npm run test:concurrency
 */
import { config } from './config/env.js';

const BASE = `http://localhost:${config.port}/api`;
const ATTEMPTS = 10;

const post = (path, body, token) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json() }));

const get = (path, token) =>
  fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

async function loginOrCreate(email, password, name) {
  const login = await post('/auth/login', { email, password });
  if (login.ok) return login.data.token;
  const reg = await post('/auth/register', { name, email, password });
  if (!reg.ok) throw new Error(`Cannot create ${email}: ${reg.data.error}`);
  return reg.data.token;
}

function nextDateKey(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
}

async function run() {
  console.log(`Racing ${ATTEMPTS} patients for one slot at ${BASE}\n`);

  // Distinct patients so the per-patient unique index is not what blocks them.
  const tokens = [];
  for (let i = 0; i < ATTEMPTS; i += 1) {
    tokens.push(await loginOrCreate(`race${i}@clinic.test`, 'Race@12345', `Race Tester ${i}`));
  }

  const { doctors } = await get('/doctors', tokens[0]);
  if (!doctors.length) throw new Error('No doctors found. Run `npm run seed` first.');
  const doctor = doctors[0];

  // Find the first future date with an open slot.
  let target = null;
  for (let day = 0; day < 14 && !target; day += 1) {
    const date = nextDateKey(day);
    const av = await get(`/doctors/${doctor.user._id}/availability?date=${date}`, tokens[0]);
    const open = (av.slots || []).find((s) => s.available);
    if (open) target = { date, startTime: open.startTime, label: open.label };
  }
  if (!target) throw new Error('No open slots in the next 14 days for this doctor.');

  console.log(`Doctor : ${doctor.user.name} (${doctor.specialisation})`);
  console.log(`Slot   : ${target.date} ${target.label}\n`);

  const results = await Promise.all(
    tokens.map((t) => post('/appointments/hold', { doctorId: doctor.user._id, startTime: target.startTime }, t))
  );

  const winners = results.filter((r) => r.ok);
  const conflicts = results.filter((r) => r.status === 409);
  const other = results.filter((r) => !r.ok && r.status !== 409);

  console.log(`  succeeded : ${winners.length}`);
  console.log(`  409 conflict : ${conflicts.length}`);
  console.log(`  unexpected : ${other.length}`);
  if (other.length) console.log('  ', other.map((o) => `${o.status} ${o.data.error}`).join('\n   '));

  console.log('\nSample rejection message:', conflicts[0]?.data?.error || '(none)');

  if (winners.length === 1 && conflicts.length === ATTEMPTS - 1) {
    console.log('\nPASS - exactly one hold was granted, everyone else got a clean 409.');
  } else {
    console.log('\nFAIL - the slot was not exclusively held.');
    process.exitCode = 1;
  }

  // tidy up so the test can be run again
  if (winners[0]) {
    await post(`/appointments/${winners[0].data.appointment.id}/cancel`, { reason: 'concurrency test cleanup' }, tokens[results.indexOf(winners[0])]);
    console.log('Cleaned up the winning hold.');
  }
}

run().catch((err) => {
  console.error('\nTest could not run:', err.message);
  process.exit(1);
});
