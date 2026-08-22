import mongoose from 'mongoose';

const medicationReminderSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medicine: { type: String, required: true },
    dosage: { type: String, default: '' },
    instructions: { type: String, default: '' },
    scheduledAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['pending', 'sent', 'cancelled'], default: 'pending', index: true },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

medicationReminderSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model('MedicationReminder', medicationReminderSchema);
