import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    billable: { type: Boolean, default: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptUrl: { type: String },
    reimbursed: { type: Boolean, default: false },
    reimbursedAt: { type: Date },
    // Billing linkage
    billed: { type: Boolean, default: false, index: true },
    billedAt: { type: Date },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerInvoice' },
  },
  { timestamps: true }
);

export const Expense = mongoose.model('Expense', expenseSchema);
