# System design write-up

*Healthcare Appointment

## Preventing double-booking

Application-level checks ("is this slot free? then insert") lose races: two requests can both read *free* before either writes. The guarantee therefore lives in the database.

Every appointment carries a boolean `slotActive`, set to `true` while the slot is occupied (`held`, `booked` or `completed`) and **removed** on cancellation. A unique **partial** index covers it:

```js
{ doctor: 1, startTime: 1 }, { unique: true, partialFilterExpression: { slotActive: true } }
```

Because the filter only indexes documents where `slotActive` is `true`, cancelled appointments drop out of the index and the slot becomes reusable, while active ones cannot collide. Two simultaneous inserts for the same doctor and instant mean one commits and the other receives error 11000, which `slot.service.js` translates into HTTP 409 with a `SLOT_TAKEN` code; the client refreshes the grid rather than showing a stale success. A second index on `{ patient: 1, startTime: 1 }` stops one patient booking two doctors at the same moment.

This holds under horizontal scaling: correctness sits in the storage engine, not in a process-local lock, so extra API instances change nothing. `npm run test:concurrency` fires ten simultaneous holds at one slot and asserts exactly one wins.

## Slot hold mechanism

The symptom form sits between choosing a time and confirming it. Reserving nothing during that window would let two patients fill forms for the same slot and let the second one fail at the last step; reserving forever would let abandoned tabs starve the calendar.

Booking is therefore two phases. `POST /appointments/hold` inserts the appointment with `status: 'held'` and `holdExpiresAt = now + SLOT_HOLD_MINUTES`. It is already `slotActive`, so the unique index protects it exactly like a confirmed booking, and the availability grid reports it as taken. `POST /appointments/:id/confirm` attaches the symptom form, generates the pre-visit summary, flips the status to `booked` and clears the expiry.

Expired holds are cleared in three places: a cron sweep every two minutes, an opportunistic `deleteMany` before any availability query or new hold, and a check at confirm time that returns `HOLD_EXPIRED` rather than silently booking a slot someone else may now own. The frontend counts the hold down so the deadline is visible, not a surprise.

## Doctor leave conflicts

Leave is a destructive operation with a fan-out, not a flag. When a doctor marks a date, `cancelDayForDoctor` loads every `held` or `booked` appointment with that `dateKey` and routes each through the single `cancelAppointment` path — the same code patients use. That path removes the Google Calendar events, sets `status: 'cancelled'`, unsets `slotActive`, cancels any pending medication reminders, and queues cancellation emails to both parties, with the patient's copy explaining that the doctor is unavailable and inviting a rebooking.

Routing every cancellation through one function is deliberate: notification and calendar cleanup can never drift apart between the four entry points (patient, doctor, admin, leave sweep). The API responds with the number of appointments cancelled so the doctor sees the blast radius immediately. Removing a leave day reopens the date but does not resurrect cancelled bookings — patients have already been told they were cancelled, so silently restoring them would be worse than asking them to rebook.

## Notification failure handling

Email delivery is slow and unreliable, so nothing sends inline. Every message is written to an `EmailJob` document first and a worker delivers it. Bookings return as soon as the row is durable, and an SMTP outage delays confirmations instead of failing bookings.

The worker runs each minute, picks up jobs where `nextAttemptAt <= now`, and on failure backs off exponentially (1, 2, 4, 8, 16 minutes) up to `EMAIL_MAX_ATTEMPTS` before marking the job `failed` with its last error. Failures are visible and repairable: the admin Notifications page lists every job with attempt counts and error text, and offers a manual retry. Medication reminders are separate rows scheduled from the prescription's frequency and duration; when they fall due the worker converts them into email jobs, so retry logic is written once.

Google Calendar is treated as best-effort. Failures are caught, recorded on the appointment as `calendar.status` (`created` / `partial` / `failed`), and never roll back a booking — a patient who never connected Google still gets a valid appointment. The LLM is handled the same way: calls are time-boxed with `AbortController`, retried twice on transient errors, and on permanent failure fall back to a deterministic rule-based summariser. Every summary records whether it came from the model or the fallback, so a doctor is never misled about the provenance of what they are reading, and the admin dashboard counts fallbacks as a health signal.
