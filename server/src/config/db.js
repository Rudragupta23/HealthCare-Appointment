import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`  mongodb connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}
