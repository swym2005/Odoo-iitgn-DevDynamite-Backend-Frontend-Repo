import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['todo', 'in-progress', 'review', 'done', 'blocked'], default: 'todo', index: true },
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const Task = mongoose.model('Task', taskSchema);
