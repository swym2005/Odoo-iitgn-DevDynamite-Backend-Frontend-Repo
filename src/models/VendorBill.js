import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String },
    product: { type: String },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const vendorBillSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    vendor: { type: String, required: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    lineItems: { type: [lineItemSchema], default: [] },
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending', index: true },
    date: { type: Date, default: () => new Date() },
    attachmentUrl: { type: String },
  },
  { timestamps: true }
);

vendorBillSchema.pre('save', function(next){
  if(Array.isArray(this.lineItems) && this.lineItems.length){
    let sum = 0;
    this.lineItems.forEach(li => {
      const qty = Number(li.quantity||0);
      const price = Number(li.unitPrice||0);
      const tax = Number(li.taxRate||0);
      li.total = Math.round(qty * price * (1 + tax) * 100)/100;
      sum += li.total;
    });
    this.amount = Math.round(sum * 100)/100;
  }
  next();
});

export const VendorBill = mongoose.model('VendorBill', vendorBillSchema);
