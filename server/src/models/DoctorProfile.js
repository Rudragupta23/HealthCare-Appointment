import mongoose from 'mongoose';

/** One working window on one weekday. 0 = Sunday ... 6 = Saturday */
const workingHourSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true }, // "09:00" clinic-local
    endTime: { type: String, required: true },   // "13:00"
  },
  { _id: false }
);

const leaveDaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "2026-09-14"
    reason: { type: String, default: 'Unavailable' },
    markedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialisation: { type: String, required: true, trim: true, index: true },
    qualification: { type: String, trim: true, default: '' },
    experienceYears: { type: Number, default: 0, min: 0 },
    consultationFee: { type: Number, default: 0, min: 0 },
    room: { type: String, default: '' },
    bio: { type: String, default: '' },
    slotDurationMinutes: { type: Number, default: 30, min: 5, max: 180 },
    workingHours: { type: [workingHourSchema], default: [] },
    leaveDays: { type: [leaveDaySchema], default: [] },
    isAcceptingPatients: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorProfileSchema.methods.isOnLeave = function (dateStr) {
  return this.leaveDays.some((l) => l.date === dateStr);
};

export default mongoose.model('DoctorProfile', doctorProfileSchema);
