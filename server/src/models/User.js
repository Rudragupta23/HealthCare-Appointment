import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

const googleSchema = new mongoose.Schema(
  {
    refreshToken: { type: String, default: null },
    accessToken: { type: String, default: null },
    expiryDate: { type: Number, default: null },
    email: { type: String, default: null },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true, index: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },
    isActive: { type: Boolean, default: true },
    google: { type: googleSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, config.bcryptRounds);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    gender: this.gender,
    dateOfBirth: this.dateOfBirth,
    calendarConnected: Boolean(this.google?.refreshToken),
  };
};

export default mongoose.model('User', userSchema);
