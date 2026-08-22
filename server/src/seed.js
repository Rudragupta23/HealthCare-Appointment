/**
 * Seeds an admin, three doctors and one demo patient.
 * Run once after configuring .env:   npm run seed
 */
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import DoctorProfile from './models/DoctorProfile.js';

const weekdayHours = (days, windows) =>
  days.flatMap((d) => windows.map(([startTime, endTime]) => ({ dayOfWeek: d, startTime, endTime })));

const DOCTORS = [
  {
    name: 'Dr Anita Rao', email: 'anita.rao@clinic.test', password: 'Doctor@12345',
    specialisation: 'General Medicine', qualification: 'MBBS, MD', experienceYears: 12,
    consultationFee: 500, room: 'A-102', slotDurationMinutes: 30,
    workingHours: weekdayHours([1, 2, 3, 4, 5], [['09:00', '13:00'], ['14:00', '17:00']]),
    bio: 'Treats everyday illness, fever, infections and long-term conditions.',
  },
  {
    name: 'Dr Imran Sheikh', email: 'imran.sheikh@clinic.test', password: 'Doctor@12345',
    specialisation: 'Cardiology', qualification: 'MBBS, DM Cardiology', experienceYears: 18,
    consultationFee: 1200, room: 'B-210', slotDurationMinutes: 20,
    workingHours: weekdayHours([1, 3, 5], [['10:00', '13:00']]).concat(weekdayHours([6], [['10:00', '12:00']])),
    bio: 'Heart rhythm, blood pressure and post-surgery follow-up.',
  },
  {
    name: 'Dr Leah Fernandes', email: 'leah.fernandes@clinic.test', password: 'Doctor@12345',
    specialisation: 'Dermatology', qualification: 'MBBS, MD Dermatology', experienceYears: 7,
    consultationFee: 800, room: 'C-004', slotDurationMinutes: 15,
    workingHours: weekdayHours([2, 4], [['11:00', '15:00']]),
    bio: 'Skin, hair and allergy clinics.',
  },
];

async function upsertUser({ name, email, password, role, phone }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, role, phone });
    await user.setPassword(password);
    await user.save();
    console.log(`  created ${role}: ${email}`);
  } else {
    console.log(`  exists  ${role}: ${email}`);
  }
  return user;
}

async function run() {
  await connectDB();

  await upsertUser({ ...config.admin, role: 'admin', phone: '+91 90000 00000' });

  for (const d of DOCTORS) {
    const user = await upsertUser({ name: d.name, email: d.email, password: d.password, role: 'doctor' });
    const existing = await DoctorProfile.findOne({ user: user._id });
    if (!existing) {
      await DoctorProfile.create({ user: user._id, ...d });
      console.log(`  profile created for ${d.name} (${d.specialisation})`);
    }
  }

  await upsertUser({ name: 'Sam Patel', email: 'patient@clinic.test', password: 'Patient@12345', role: 'patient', phone: '+91 98765 43210' });

  console.log('\nSeed complete. Sign in with:');
  console.log(`  admin   ${config.admin.email} / ${config.admin.password}`);
  console.log('  doctor  anita.rao@clinic.test / Doctor@12345');
  console.log('  patient patient@clinic.test / Patient@12345\n');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
