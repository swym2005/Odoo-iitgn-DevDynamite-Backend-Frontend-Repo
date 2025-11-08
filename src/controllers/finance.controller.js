import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  salesOrderCreateSchema,
  purchaseOrderCreateSchema,
  customerInvoiceCreateSchema,
  vendorBillCreateSchema,
} from '../validators/finance.validators.js';
import {
  listSalesOrders,
  createSalesOrder,
  setSalesOrderStatus,
  listPurchaseOrders,
  createPurchaseOrder,
  setPurchaseOrderStatus,
  listCustomerInvoices,
  createCustomerInvoice,
  setInvoicePaid,
  listVendorBills,
  createVendorBill,
  setVendorBillPaid,
  financeDashboard,
} from '../services/finance.service.js';
import { createNotification } from '../services/notifications.service.js';
import { Roles } from '../utils/roles.js';

const billsDir = path.resolve('uploads/bills');
if (!fs.existsSync(billsDir)) fs.mkdirSync(billsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, billsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});
export const billUpload = multer({ storage });

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const dashboard = async (req, res, next) => {
  try { res.json({ success: true, ...(await financeDashboard()) }); } catch (e) { next(e); }
};

// Sales Orders
export const salesOrdersGet = async (req, res, next) => {
  try { res.json({ success: true, items: await listSalesOrders() }); } catch (e) { next(e); }
};
export const salesOrdersPost = async (req, res, next) => {
  try { const data = validate(salesOrderCreateSchema, req.body); res.status(201).json({ success: true, item: await createSalesOrder(data) }); } catch (e) { next(e); }
};
export const salesOrdersConfirm = async (req, res, next) => {
  try { res.json({ success: true, item: await setSalesOrderStatus(req.params.id, 'Confirmed') }); } catch (e) { next(e); }
};
export const salesOrdersPaid = async (req, res, next) => {
  try { res.json({ success: true, item: await setSalesOrderStatus(req.params.id, 'Paid') }); } catch (e) { next(e); }
};

// Purchase Orders
export const purchaseOrdersGet = async (req, res, next) => {
  try { res.json({ success: true, items: await listPurchaseOrders() }); } catch (e) { next(e); }
};
export const purchaseOrdersPost = async (req, res, next) => {
  try { const data = validate(purchaseOrderCreateSchema, req.body); res.status(201).json({ success: true, item: await createPurchaseOrder(data) }); } catch (e) { next(e); }
};
export const purchaseOrdersApprove = async (req, res, next) => {
  try { res.json({ success: true, item: await setPurchaseOrderStatus(req.params.id, 'Approved') }); } catch (e) { next(e); }
};
export const purchaseOrdersPaid = async (req, res, next) => {
  try { res.json({ success: true, item: await setPurchaseOrderStatus(req.params.id, 'Paid') }); } catch (e) { next(e); }
};

// Customer Invoices
export const invoicesGet = async (req, res, next) => {
  try { res.json({ success: true, items: await listCustomerInvoices() }); } catch (e) { next(e); }
};
export const invoicesPost = async (req, res, next) => {
  try { const data = validate(customerInvoiceCreateSchema, req.body); res.status(201).json({ success: true, item: await createCustomerInvoice(data) }); } catch (e) { next(e); }
};
export const invoicesPaid = async (req, res, next) => {
  try {
    const inv = await setInvoicePaid(req.params.id);
    // Notify Finance and Admin roles
    await createNotification({ audienceRole: Roles.Finance, project: inv.project, type: 'payment', title: 'Invoice Paid', message: `${inv.number} marked paid`, link: '/finance/invoices', meta: { invoiceId: String(inv._id), amount: inv.amount } });
    await createNotification({ audienceRole: Roles.Admin, project: inv.project, type: 'payment', title: 'Invoice Paid', message: `${inv.number} marked paid`, link: '/finance/invoices', meta: { invoiceId: String(inv._id), amount: inv.amount } });
    res.json({ success: true, item: inv });
  } catch (e) { next(e); }
};

// Vendor Bills
export const billsGet = async (req, res, next) => {
  try { res.json({ success: true, items: await listVendorBills() }); } catch (e) { next(e); }
};
export const billsPost = async (req, res, next) => {
  try {
    const data = validate(vendorBillCreateSchema, req.body);
    const attachmentUrl = req.file ? `/uploads/bills/${req.file.filename}` : undefined;
    res.status(201).json({ success: true, item: await createVendorBill(data, attachmentUrl) });
  } catch (e) { next(e); }
};
export const billsPaid = async (req, res, next) => {
  try {
    const bill = await setVendorBillPaid(req.params.id);
    await createNotification({ audienceRole: Roles.Finance, project: bill.project, type: 'payment', title: 'Vendor Bill Paid', message: `${bill.number} marked paid`, link: '/finance/bills', meta: { billId: String(bill._id), amount: bill.amount } });
    await createNotification({ audienceRole: Roles.Admin, project: bill.project, type: 'payment', title: 'Vendor Bill Paid', message: `${bill.number} marked paid`, link: '/finance/bills', meta: { billId: String(bill._id), amount: bill.amount } });
    res.json({ success: true, item: bill });
  } catch (e) { next(e); }
};
