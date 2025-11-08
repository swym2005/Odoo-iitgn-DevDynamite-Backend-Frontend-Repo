import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hours: { type: Number, required: true, min: 0 },
    billable: { type: Boolean, default: true },
    note: { type: String },
    date: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

export const Timesheet = mongoose.model('Timesheet', timesheetSchema);
