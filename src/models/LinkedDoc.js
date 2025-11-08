import mongoose from 'mongoose';

const linkedDocSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    type: { type: String, enum: ['SO', 'PO', 'CustomerInvoice', 'VendorBill', 'Expense'], required: true, index: true },
    refId: { type: String, required: true },
    meta: { type: Object },
  },
  { timestamps: true }
);

export const LinkedDoc = mongoose.model('LinkedDoc', linkedDocSchema);
