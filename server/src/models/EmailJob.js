import mongoose from 'mongoose';

/**
 * Every outbound email is written to this collection first and sent by a
 * background worker. Nothing is lost if the mail provider is down - the job
 * simply retries with exponential backoff.
 */
const emailJobSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, default: '' },
    type: { type: String, default: 'generic', index: true },
    relatedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailJobSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model('EmailJob', emailJobSchema);
