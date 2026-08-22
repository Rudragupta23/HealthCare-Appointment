# Healthcare Appointment & Follow-up Manager

A clinic platform with three portals — **patient**, **doctor**, **admin** — built around one idea: the consultation should start prepared. Patients describe symptoms before the visit, an LLM triages them for the doctor, and the doctor's notes come back to the patient in plain language with a medication schedule that emails itself.

**Stack:** Node.js + Express + MongoDB (Mongoose) · React + Vite · Nodemailer/SendGrid · Google Calendar API (OAuth 2.0) · pluggable LLM (Anthropic / OpenAI / Gemini)

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Quick start](#2-quick-start)
3. [Environment variables — every value explained](#3-environment-variables--every-value-explained)
4. [Getting the real credentials](#4-getting-the-real-credentials)
5. [Database schema](#5-database-schema)
6. [API reference](#6-api-reference)
7. [LLM prompts](#7-llm-prompts)
8. [Google Calendar setup](#8-google-calendar-setup)
9. [How the hard parts work](#9-how-the-hard-parts-work)
10. [Testing it](#10-testing-it)
11. [Deployment](#11-deployment)
12. [Project structure](#12-project-structure)

---

## 1. What it does

**Admin** creates and manages doctor profiles — specialisation, qualification, fee, room, slot duration, weekly working windows, leave days — and can deactivate a doctor, browse every appointment, and inspect or retry failed notifications.

**Patient** registers, searches doctors by specialisation or name, sees a live slot grid, holds a slot, fills a symptom form, and confirms. Afterwards they get the plain-language visit summary, their medication schedule, and reminder emails per dose.

**Doctor** opens a day view where every consultation carries the AI urgency verdict as a coloured spine, reads the pre-visit summary and the patient's own words, then submits notes and a prescription — which generates the patient summary and schedules the reminders.

**Automatically:** confirmation, reminder and cancellation emails to both sides; Google Calendar events created on booking, moved on reschedule, deleted on cancellation; medication reminders on the prescription's frequency; email retries with backoff.

---

## 2. Quick start

You need **Node 18+** and **MongoDB** (local, or a free MongoDB Atlas cluster).

```bash
# 1. backend
cd server
npm install
cp .env.example .env          # then edit .env — see section 3
npm run seed                  # creates admin, 3 doctors, 1 demo patient
npm start                     # http://localhost:5000

# 2. frontend (new terminal)
cd client
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 and sign in:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@clinic.test` | `Admin@12345` |
| Doctor | `anita.rao@clinic.test` | `Doctor@12345` |
| Patient | `patient@clinic.test` | `Patient@12345` |

**It runs with zero external accounts.** Out of the box `EMAIL_PROVIDER=console` prints emails to your terminal, `LLM_PROVIDER=none` uses the built-in rule-based summariser, and Calendar sync stays off. Add real credentials when you want the real thing — the app never breaks when an integration is missing.

---

## 3. Environment variables — every value explained

Create `server/.env` from `server/.env.example`. Below is what each variable is for and **what to actually put in it**.

### Core

| Variable | Put this | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` when deployed |
| `PORT` | `5000` | Hosts like Render set this themselves — leave it |
| `CLIENT_URL` | `http://localhost:5173` | Your deployed frontend URL in production. Used for CORS and email links |
| `SERVER_URL` | `http://localhost:5000` | Your deployed API URL in production |

### Database

| Variable | Put this |
|---|---|
| `MONGODB_URI` | Local: `mongodb://127.0.0.1:27017/healthcare_appointments`<br>Atlas: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/healthcare_appointments?retryWrites=true&w=majority` |

If your Atlas password contains `@ : / ?` you must URL-encode it (`@` → `%40`).

### Auth

| Variable | Put this |
|---|---|
| `JWT_SECRET` | A long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `BCRYPT_ROUNDS` | `10` |

### Seed admin

`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the admin account `npm run seed` creates. Change the password before deploying anywhere public.

### Booking rules

| Variable | Put this | What it controls |
|---|---|---|
| `SLOT_HOLD_MINUTES` | `10` | How long a slot stays reserved while the patient fills the symptom form |
| `APPOINTMENT_REMINDER_LEAD_MINUTES` | `60` | How far ahead the reminder email goes out |
| `CLINIC_TIMEZONE` | `Asia/Kolkata` | An IANA zone. All working hours and slots are interpreted in this zone |

### LLM

| Variable | Put this |
|---|---|
| `LLM_PROVIDER` | `none`, `anthropic`, `openai`, or `gemini` |
| `LLM_API_KEY` | The key from that provider (blank if `none`) |
| `LLM_MODEL` | Anthropic: `claude-sonnet-4-5` · OpenAI: `gpt-4o-mini` · Gemini: `gemini-1.5-flash` |
| `LLM_TIMEOUT_MS` | `20000` |
| `LLM_MAX_RETRIES` | `2` |

With `none`, summaries come from the rule-based fallback and the UI says so. Nothing crashes.

### Email

| Variable | Put this |
|---|---|
| `EMAIL_PROVIDER` | `console` (dev), `smtp` (Gmail/Mailtrap/Mailgun), or `sendgrid` |
| `EMAIL_FROM` | `"City Clinic <youraddress@gmail.com>"` — must match your SMTP account for Gmail |
| `SMTP_HOST` | Gmail: `smtp.gmail.com` · Mailtrap: `sandbox.smtp.mailtrap.io` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` for port 587, `true` for 465 |
| `SMTP_USER` | Your full Gmail address |
| `SMTP_PASS` | Your 16-character Gmail **App Password** — *not* your Google password |
| `SENDGRID_API_KEY` | Only if `EMAIL_PROVIDER=sendgrid` |
| `EMAIL_MAX_ATTEMPTS` | `5` |

### Google Calendar

| Variable | Put this |
|---|---|
| `GOOGLE_CALENDAR_ENABLED` | `true` once you have credentials, else `false` |
| `GOOGLE_CLIENT_ID` | Ends in `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | From the same OAuth client |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/calendar/oauth/callback` — **must match Google Console exactly** |

### Jobs

`ENABLE_JOBS=true`. Set to `false` only if you run the cron workers as a separate process.

### Frontend (`client/.env`)

```
VITE_API_URL=http://localhost:5000/api
```

---

## 4. Getting the real credentials

### A Gmail App Password (for real emails)

1. Turn on 2-Step Verification: <https://myaccount.google.com/security>
2. Go to <https://myaccount.google.com/apppasswords>
3. Create an app password named "Clinic"
4. Paste the 16 characters (no spaces) into `SMTP_PASS`, your Gmail address into `SMTP_USER`, and set `EMAIL_PROVIDER=smtp`

*Prefer not to use a personal inbox?* Use [Mailtrap](https://mailtrap.io) — a free sandbox that catches everything: set `SMTP_HOST=sandbox.smtp.mailtrap.io` with the username and password from your inbox settings.

### An LLM API key

- **Anthropic** — <https://console.anthropic.com> → API Keys. Key starts `sk-ant-`
- **OpenAI** — <https://platform.openai.com/api-keys>. Key starts `sk-`
- **Google Gemini** — <https://aistudio.google.com/app/apikey>. Has a free tier

### MongoDB Atlas (free)

1. <https://cloud.mongodb.com> → create a free M0 cluster
2. Database Access → add a user with a password
3. Network Access → allow `0.0.0.0/0` (fine for a student project)
4. Connect → Drivers → copy the connection string into `MONGODB_URI`, replacing `<password>` and adding `/healthcare_appointments` before the `?`

---

## 5. Database schema

**users**
```
_id, name, email (unique, lowercase), passwordHash, role: patient|doctor|admin,
phone, dateOfBirth, gender, isActive,
google: { refreshToken, accessToken, expiryDate, email, connectedAt },
createdAt, updatedAt
```

**doctorprofiles** — one per doctor user
```
_id, user (ref User, unique), specialisation (indexed), qualification,
experienceYears, consultationFee, room, bio,
slotDurationMinutes,
workingHours: [{ dayOfWeek 0-6, startTime "09:00", endTime "13:00" }],
leaveDays:    [{ date "2026-09-14", reason, markedAt }],
isAcceptingPatients
```

**appointments** — the core record
```
_id, doctor (ref User), doctorProfile (ref), patient (ref User),
startTime, endTime, dateKey "YYYY-MM-DD",
status: held|booked|completed|cancelled|no_show,
slotActive: true | undefined,          <- drives the unique index
holdExpiresAt,
cancelledBy, cancellationReason, rescheduledFrom,

symptomForm:     { description, durationOfSymptoms, painLevel, existingConditions,
                   currentMedication, allergies, submittedAt },
preVisitSummary: { urgency Low|Medium|High|Unknown, chiefComplaint,
                   suggestedQuestions[], raw, source llm|fallback|pending,
                   model, error, generatedAt },
postVisit:       { clinicalNotes, diagnosis, followUpDate, patientSummary,
                   medicationSchedule, followUpSteps[], source, model, error },
prescriptions:   [{ medicine, dosage, timesPerDay, durationDays, instructions }],
calendar:        { patientEventId, doctorEventId, status, lastError },
reminderSent
```

Indexes:
```js
{ doctor: 1,  startTime: 1 }  unique, partial: { slotActive: true }   // no double-booking
{ patient: 1, startTime: 1 }  unique, partial: { slotActive: true }   // no patient overlap
{ status: 1, holdExpiresAt: 1 }
{ status: 1, startTime: 1, reminderSent: 1 }
```

**medicationreminders**
```
_id, appointment (ref), patient (ref), medicine, dosage, instructions,
scheduledAt, status: pending|sent|cancelled, sentAt
```

**emailjobs** — durable outbox
```
_id, to, subject, html, text, type, relatedAppointment,
status: pending|sent|failed, attempts, nextAttemptAt, lastError, sentAt
```

---

## 6. API reference

Base URL `/api`. Everything except register/login/health needs `Authorization: Bearer <token>`.

### Auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Patient self-registration |
| POST | `/auth/login` | — | Returns `{ token, user }` |
| GET | `/auth/me` | any | Current user (+ doctor profile) |
| PATCH | `/auth/me` | any | Update own details |
| POST | `/auth/change-password` | any | Change password |

### Doctor directory
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/doctors?specialisation=&q=` | any | Search |
| GET | `/doctors/specialisations` | any | Filter options |
| GET | `/doctors/:id` | any | One profile |
| GET | `/doctors/:id/availability?date=YYYY-MM-DD` | any | Slot grid with availability flags |

### Doctor's own tools
| Method | Path | Purpose |
|---|---|---|
| GET | `/doctor/schedule?date=` | Day view with pre-visit summaries |
| PATCH | `/doctor/profile` | Hours, slot length, bio, accepting toggle |
| POST | `/doctor/leave` | Mark leave → cancels + notifies that day |
| DELETE | `/doctor/leave` | Reopen a date |

### Appointments
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/appointments/hold` | patient | Reserve a slot (`{ doctorId, startTime }`) |
| POST | `/appointments/:id/confirm` | patient | Symptom form → LLM triage → booked |
| GET | `/appointments?scope=upcoming\|past&status=` | any | My appointments |
| GET | `/appointments/:id` | participant | Full record (patients never see raw clinical notes) |
| GET | `/appointments/stats` | any | Counts by status |
| GET | `/appointments/reminders` | patient | Medication schedule |
| POST | `/appointments/:id/cancel` | participant | Cancel + notify + clear calendar |
| POST | `/appointments/:id/reschedule` | participant | Move to a new slot |
| POST | `/appointments/:id/post-visit` | doctor | Notes + prescription → summary + reminders |
| POST | `/appointments/:id/no-show` | doctor/admin | Mark no-show |

### Calendar
`GET /calendar/status` · `POST /calendar/connect` · `GET /calendar/oauth/callback` · `POST /calendar/disconnect`

### Admin
`GET /admin/dashboard` · `GET /admin/users` · `GET /admin/appointments` · `POST /admin/doctors` · `PATCH /admin/doctors/:id` · `DELETE /admin/doctors/:id` · `POST|DELETE /admin/doctors/:id/leave` · `GET /admin/emails` · `POST /admin/emails/:id/retry`

### Error codes worth handling in a client

| Code | Meaning |
|---|---|
| `SLOT_TAKEN` | Lost the race — refresh the grid |
| `PATIENT_DOUBLE_BOOKED` | This patient already has that time |
| `HOLD_EXPIRED` | Hold lapsed — pick a slot again |
| `DOCTOR_ON_LEAVE` | Date was closed after the page loaded |
| `INVALID_SLOT` | Not aligned to the doctor's published grid |

---

## 7. LLM prompts

Both live in `server/src/services/llm.service.js`.

**Pre-visit** — system prompt establishes a triage assistant that never diagnoses or prescribes and replies with raw JSON. User prompt:

> Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: `<symptoms>`

followed by the required JSON shape `{"urgency","chiefComplaint","suggestedQuestions"}`.

**Post-visit** — system prompt establishes a plain-language rewriter that never invents medication. User prompt:

> Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: `<notes>`

followed by the required shape `{"patientSummary","medicationSchedule","followUpSteps"}`.

Handling: responses are parsed leniently (code fences and stray prose are stripped, the outermost `{...}` recovered), the urgency value is validated against the allowed three, and both outputs are stored on the appointment with a `source` of `llm` or `fallback` so nobody mistakes a rule-based summary for an AI one.

---

## 8. Google Calendar setup

1. <https://console.cloud.google.com> → create a project
2. **APIs & Services → Library** → enable **Google Calendar API**
3. **OAuth consent screen** → External → fill the app name and support email → add scope `.../auth/calendar.events` → **add your own Google account under Test users** (unpublished apps only work for test users)
4. **Credentials → Create credentials → OAuth client ID → Web application**
5. Under *Authorised redirect URIs* add exactly:
   `http://localhost:5000/api/calendar/oauth/callback`
   (and your deployed equivalent, e.g. `https://your-api.onrender.com/api/calendar/oauth/callback`)
6. Copy the client ID and secret into `.env`, set `GOOGLE_CALENDAR_ENABLED=true`, restart
7. In the app: **Calendar → Connect Google Calendar**. Do this for a patient *and* a doctor account to see events on both sides

**Common mistakes:** `redirect_uri_mismatch` means the URI in `.env` differs from the Console by even a trailing slash. `access_denied` means your account is not in Test users. If no refresh token arrives, revoke access at <https://myaccount.google.com/permissions> and reconnect — the app already sends `prompt=consent`.

---

## 9. How the hard parts work

Full reasoning is in **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)**. In brief:

- **Double-booking** — a unique *partial* index on `{ doctor, startTime }` filtered to `slotActive: true`. Concurrent inserts can't both win; the loser's duplicate-key error becomes a clean 409. Cancelled rows leave the index, freeing the slot.
- **Slot holds** — booking is two-phase. The hold is a real row (so the index protects it) with an expiry, swept by cron, opportunistically on read, and re-checked at confirm time.
- **Doctor leave** — marking leave cancels every booking that day through the *same* cancellation path patients use, so emails, calendar cleanup and reminder cancellation can never drift apart.
- **Notification reliability** — every email is queued in `emailjobs` before sending; a worker retries with exponential backoff and the admin can inspect and retry failures.
- **Graceful degradation** — LLM calls are time-boxed and fall back to a rule-based summariser; calendar failures are recorded but never roll back a booking.

---

## 10. Testing it

**Prove the double-booking guard** — with the server running and data seeded:

```bash
cd server && npm run test:concurrency
```

Ten patients race for one slot simultaneously. Expected output: one success, nine 409s.

**Walk the whole flow manually**

1. Sign in as **admin** → Doctors → create one with today in its working hours
2. Sign in as **patient** → Book → pick that doctor → hold a slot (watch the countdown) → submit symptoms mentioning *chest pain* → confirm
3. Watch the server terminal: two confirmation emails print (console provider)
4. Sign in as the **doctor** → today's list shows the visit with a red spine and **High urgency**
5. Open it → submit notes plus a prescription (3×/day for 5 days)
6. Back as the patient → the summary is on the appointment, and **Medication** lists 15 scheduled doses
7. As the doctor → **Hours & leave** → mark tomorrow as leave after booking something → the patient is cancelled and emailed

**Check triage without an API key** — the fallback flags `chest pain`, `breathless`, `seizure` and pain ≥ 8 as High, and mild descriptions as Low.

---

## 11. Deployment

**Backend on Render**

1. New → Web Service → connect the repo → root directory `server`
2. Build `npm install`, start `npm start`
3. Add every variable from `.env` in the Environment tab, with `NODE_ENV=production`, `CLIENT_URL` = your deployed frontend, `SERVER_URL` = the Render URL
4. Add the Render callback URL to the Google Console redirect URIs

**Frontend on Render**

1. Import the repo → root directory `client` → framework Vite
2. Environment variable `VITE_API_URL=https://your-api.onrender.com/api`
3. Deploy, then set that URL as `CLIENT_URL` on the backend

---

## 12. Project structure

```
healthcare-appointment-manager/
├── README.md
├── SYSTEM_DESIGN.md
├── .gitignore
├── server/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js                 entry point
│       ├── app.js                    express wiring
│       ├── seed.js                   demo data
│       ├── test.concurrency.js       double-booking proof
│       ├── config/                   env.js, db.js
│       ├── models/                   User, DoctorProfile, Appointment,
│       │                             MedicationReminder, EmailJob
│       ├── middleware/               auth.js (JWT + roles), error.js
│       ├── routes/index.js           every endpoint
│       ├── controllers/              auth, doctor, admin, appointment, calendar
│       ├── services/
│       │   ├── slot.service.js       availability, holds, conflict guard
│       │   ├── appointment.service.js cancellation + leave fan-out
│       │   ├── llm.service.js        prompts, retries, fallbacks
│       │   ├── email.service.js      outbox, backoff, templates
│       │   └── calendar.service.js   OAuth + event lifecycle
│       ├── jobs/scheduler.js         cron workers
│       └── utils/                    time.js (timezone), apiError.js
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, api.js, AuthContext.jsx, styles.css
        ├── components/               Layout.jsx, ui.jsx
        └── pages/                    Login, Register, PatientHome,
                                      BookAppointment, AppointmentDetail,
                                      Reminders, DoctorHome, DoctorHours,
                                      AdminHome, AdminDoctors,
                                      AdminAppointments, AdminNotifications,
                                      CalendarSettings
```

**Submission note:** `node_modules`, `.env` and build output are excluded by `.gitignore`. Commit `.env.example`, never `.env`. Push to a **public** repo on the **main** branch.
