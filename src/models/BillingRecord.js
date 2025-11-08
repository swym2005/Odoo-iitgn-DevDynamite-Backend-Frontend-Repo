import mongoose from 'mongoose';

const billingRecordSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['revenue', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    notes: { type: String },
  },
  { timestamps: true }
);

export const BillingRecord = mongoose.model('BillingRecord', billingRecordSchema);
