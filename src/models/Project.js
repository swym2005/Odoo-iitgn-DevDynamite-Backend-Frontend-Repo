import mongoose from 'mongoose';
import { User } from './User.js';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'], default: 'planning' },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);
