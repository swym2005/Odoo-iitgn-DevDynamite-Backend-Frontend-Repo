import mongoose from 'mongoose';
import { User } from './User.js';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    client: { type: String, trim: true },
    budget: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'], default: 'planning', index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    deadline: { type: Date },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);
