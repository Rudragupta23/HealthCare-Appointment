import mongoose from 'mongoose';

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true, trim: true },
    dosage: { type: String, default: '' },              // "500 mg"
    timesPerDay: { type: Number, default: 1, min: 1, max: 6 },
    durationDays: { type: Number, default: 1, min: 1, max: 180 },
    instructions: { type: String, default: '' },        // "after food"
  },
  { _id: false }
);

const symptomFormSchema = new mongoose.Schema(
  {
    description: { type: String, default: '' },
    durationOfSymptoms: { type: String, default: '' },
    painLevel: { type: Number, min: 0, max: 10, default: 0 },
    existingConditions: { type: String, default: '' },
    currentMedication: { type: String, default: '' },
    allergies: { type: String, default: '' },
    submittedAt: { type: Date },
  },
  { _id: false }
);

const preVisitSchema = new mongoose.Schema(
  {
    urgency: { type: String, enum: ['Low', 'Medium', 'High', 'Unknown'], default: 'Unknown' },
    chiefComplaint: { type: String, default: '' },
    suggestedQuestions: { type: [String], default: [] },
    raw: { type: String, default: '' },
    source: { type: String, enum: ['llm', 'fallback', 'pending'], default: 'pending' },
    model: { type: String, default: '' },
    error: { type: String, default: '' },
    generatedAt: { type: Date },
  },
  { _id: false }
);

const postVisitSchema = new mongoose.Schema(
  {
    clinicalNotes: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    followUpDate: { type: Date, default: null },
    patientSummary: { type: String, default: '' },
    medicationSchedule: { type: String, default: '' },
    followUpSteps: { type: [String], default: [] },
    source: { type: String, enum: ['llm', 'fallback', 'pending'], default: 'pending' },
    model: { type: String, default: '' },
    error: { type: String, default: '' },
    generatedAt: { type: Date },
  },
  { _id: false }
);

const calendarSchema = new mongoose.Schema(
  {
    patientEventId: { type: String, default: null },
    doctorEventId: { type: String, default: null },
    status: { type: String, enum: ['none', 'created', 'partial', 'failed', 'deleted'], default: 'none' },
    lastError: { type: String, default: '' },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    dateKey: { type: String, required: true, index: true }, // "2026-09-14" clinic-local

    status: {
      type: String,
      enum: ['held', 'booked', 'completed', 'cancelled', 'no_show'],
      default: 'held',
      index: true,
    },
    cancelledBy: { type: String, enum: ['patient', 'doctor', 'admin', 'system', null], default: null },
    cancellationReason: { type: String, default: '' },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    /**
     * Only set to `true` while the slot is occupied (held / booked / completed).
     * It is removed on cancellation. Combined with the partial unique index
     * below, this is what makes double-booking impossible at the DB level.
     */
    slotActive: { type: Boolean, default: true },
    holdExpiresAt: { type: Date, default: null },

    symptomForm: { type: symptomFormSchema, default: () => ({}) },
    preVisitSummary: { type: preVisitSchema, default: () => ({}) },
    postVisit: { type: postVisitSchema, default: () => ({}) },
    prescriptions: { type: [prescriptionItemSchema], default: [] },

    calendar: { type: calendarSchema, default: () => ({}) },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hard guarantee against double booking / race conditions.
appointmentSchema.index(
  { doctor: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { slotActive: true }, name: 'uniq_active_doctor_slot' }
);

// A patient cannot hold two different slots at the same moment either.
appointmentSchema.index(
  { patient: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { slotActive: true }, name: 'uniq_active_patient_slot' }
);

appointmentSchema.index({ status: 1, holdExpiresAt: 1 });
appointmentSchema.index({ status: 1, startTime: 1, reminderSent: 1 });

export default mongoose.model('Appointment', appointmentSchema);
