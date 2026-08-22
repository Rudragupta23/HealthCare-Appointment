import dotenv from 'dotenv';
dotenv.config();

const bool = (v, d = false) => (v === undefined ? d : String(v).toLowerCase() === 'true');
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthcare_appointments',

  jwtSecret: process.env.JWT_SECRET || 'dev_only_insecure_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  admin: {
    name: process.env.ADMIN_NAME || 'Clinic Admin',
    email: process.env.ADMIN_EMAIL || 'admin@clinic.test',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },

  slotHoldMinutes: num(process.env.SLOT_HOLD_MINUTES, 10),
  reminderLeadMinutes: num(process.env.APPOINTMENT_REMINDER_LEAD_MINUTES, 60),
  timezone: process.env.CLINIC_TIMEZONE || 'Asia/Kolkata',

  llm: {
    provider: (process.env.LLM_PROVIDER || 'none').toLowerCase(),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'claude-sonnet-4-5',
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 20000),
    maxRetries: num(process.env.LLM_MAX_RETRIES, 2),
  },

  email: {
    provider: (process.env.EMAIL_PROVIDER || 'console').toLowerCase(),
    from: process.env.EMAIL_FROM || 'City Clinic <no-reply@clinic.test>',
    smtp: {
      host: process.env.SMTP_HOST,
      port: num(process.env.SMTP_PORT, 587),
      secure: bool(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    sendgridKey: process.env.SENDGRID_API_KEY || '',
    maxAttempts: num(process.env.EMAIL_MAX_ATTEMPTS, 5),
  },

  google: {
    enabled: bool(process.env.GOOGLE_CALENDAR_ENABLED, false),
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/oauth/callback',
  },

  enableJobs: bool(process.env.ENABLE_JOBS, true),
};

export function reportConfig() {
  const on = (x) => (x ? 'on' : 'off');
  console.log('- configuration -------------------------------');
  console.log(`  environment      : ${config.env}`);
  console.log(`  LLM provider     : ${config.llm.provider}${config.llm.provider !== 'none' && !config.llm.apiKey ? '  (no API key -> fallback summaries)' : ''}`);
  console.log(`  email provider   : ${config.email.provider}`);
  console.log(`  google calendar  : ${on(config.google.enabled && config.google.clientId)}`);
  console.log(`  background jobs  : ${on(config.enableJobs)}`);
  if (config.jwtSecret === 'dev_only_insecure_secret') console.log('  ! JWT_SECRET is not set - do not use this in production');
  console.log('-----------------------------------------------');
}
