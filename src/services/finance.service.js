import { SalesOrder } from '../models/SalesOrder.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { VendorBill } from '../models/VendorBill.js';
import { Expense } from '../models/Expense.js';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const parseFilters = (query = {}) => {
  const q = {};
  const { status, project, from, to, search } = query;
  if (status) q.status = Array.isArray(status) ? { $in: status } : status;
  if (project) {
    try { q.project = new mongoose.Types.ObjectId(project); } catch {}
  }
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
  }
  const s = (search || '').toString().trim();
  return { q, search: s };
};

const applySearch = (docs, search, fields) => {
  if (!search) return docs;
  const s = search.toLowerCase();
  return docs.filter(d => fields.some(f => (d[f] || '').toString().toLowerCase().includes(s)));
};

const maybeGroup = (docs, groupBy) => {
  if (!groupBy) return null;
  const map = new Map();
  for (const d of docs) {
    const key = (groupBy === 'project' ? (d.project?.name || d.project || 'Unassigned')
      : groupBy === 'status' ? (d.status || '—')
      : groupBy === 'party' ? (d.customer || d.vendor || '—')
      : '—');
    const entry = map.get(key) || { key, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(d.amount || 0);
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a,b)=> b.total - a.total);
};

export const listSalesOrders = async (filters = {}) => {
  const { q, search } = parseFilters(filters);
  const rows = await SalesOrder.find(q).populate('project', 'name').sort({ createdAt: -1 }).lean();
  const items = applySearch(rows, search, ['number', 'vendor', 'customer', 'description']);
  const groups = maybeGroup(items, filters.groupBy);
  return { items, groups };
};

let soCounter = 1000;
export const createSalesOrder = async ({ customer, project, amount, description, lineItems }) => {
  const number = `SO-${++soCounter}`;
  return SalesOrder.create({ number, customer, project, amount, description, lineItems: Array.isArray(lineItems)? lineItems: [], status: 'Draft' });
};

export const setSalesOrderStatus = async (id, status) => {
  const so = await SalesOrder.findById(id);
  if (!so) { const e = new Error('Sales Order not found'); e.status = 404; throw e; }
  so.status = status;
  await so.save();
  return so;
};

export const createInvoiceFromSalesOrder = async (soId) => {
  const so = await SalesOrder.findById(soId).lean();
  if (!so) { const e = new Error('Sales Order not found'); e.status = 404; throw e; }
  // Default invoice mirrors SO: customer, project, amount, lineItems, and references the SO
  // Per problem statement: "Generated invoice lines link back to the Project (and Sales Order if used)"
  const inv = await createCustomerInvoice({
    customer: so.customer,
    project: so.project,
    amount: so.amount,
    salesOrder: so._id,
    lineItems: Array.isArray(so.lineItems) ? so.lineItems.map(li => ({
      product: li.product,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      taxRate: li.taxRate,
      project: so.project, // Link back to Project
      salesOrder: so._id, // Link back to Sales Order
    })) : [],
    date: new Date(),
  });
  return inv;
};

export const listPurchaseOrders = async (filters = {}) => {
  const { q, search } = parseFilters(filters);
  const rows = await PurchaseOrder.find(q).populate('project', 'name').sort({ createdAt: -1 }).lean();
  const items = applySearch(rows, search, ['number', 'vendor', 'description']);
  const groups = maybeGroup(items, filters.groupBy);
  return { items, groups };
};

let poCounter = 2000;
export const createPurchaseOrder = async ({ vendor, project, amount, description, lineItems }) => {
  const number = `PO-${++poCounter}`;
  return PurchaseOrder.create({ number, vendor, project, amount, description, lineItems: Array.isArray(lineItems)? lineItems: [], status: 'Draft' });
};

export const setPurchaseOrderStatus = async (id, status) => {
  const po = await PurchaseOrder.findById(id);
  if (!po) { const e = new Error('Purchase Order not found'); e.status = 404; throw e; }
  po.status = status;
  await po.save();
  return po;
};

export const listCustomerInvoices = async (filters = {}) => {
  const { q, search } = parseFilters(filters);
  const rows = await CustomerInvoice.find(q).populate('project', 'name').populate('salesOrder', 'number').sort({ createdAt: -1 }).lean();
  const items = applySearch(rows, search, ['number', 'customer']);
  const groups = maybeGroup(items, filters.groupBy);
  return { items, groups };
};

// Get next invoice number by finding the highest existing number
const getNextInvoiceNumber = async () => {
  // Find all invoices and extract the maximum number
  const invoices = await CustomerInvoice.find({ number: { $regex: /^INV-\d+$/ } }).select('number').lean();
  if (!invoices || invoices.length === 0) {
    return 'INV-3001';
  }
  let maxNum = 3000;
  invoices.forEach(inv => {
    const match = inv.number?.match(/INV-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `INV-${maxNum + 1}`;
};

export const createCustomerInvoice = async ({ customer, project, amount, salesOrder, date, lineItems }) => {
  const number = await getNextInvoiceNumber();
  // Ensure lineItems have project and salesOrder links (per problem statement)
  const processedLineItems = Array.isArray(lineItems) ? lineItems.map(li => ({
    ...li,
    project: li.project || project, // Link back to Project
    salesOrder: li.salesOrder || salesOrder || undefined, // Link back to Sales Order if used
  })) : [];
  return CustomerInvoice.create({ number, customer, project, amount, salesOrder: salesOrder || undefined, lineItems: processedLineItems, status: 'Draft', date: date ? new Date(date) : new Date() });
};

export const setInvoicePaid = async (id) => {
  const inv = await CustomerInvoice.findById(id);
  if (!inv) { const e = new Error('Invoice not found'); e.status = 404; throw e; }
  const wasPaid = inv.status === 'Paid';
  inv.status = 'Paid';
  await inv.save();
  
  // Update project revenue when invoice is marked as Paid
  if (!wasPaid && inv.project) {
    const { Project } = await import('../models/Project.js');
    await Project.findByIdAndUpdate(inv.project, { $inc: { revenue: inv.amount } });
  }
  
  return inv;
};

export const listVendorBills = async (filters = {}) => {
  const { q, search } = parseFilters(filters);
  const rows = await VendorBill.find(q).populate('project', 'name').populate('purchaseOrder', 'number').sort({ createdAt: -1 }).lean();
  const items = applySearch(rows, search, ['number', 'vendor']);
  const groups = maybeGroup(items, filters.groupBy);
  return { items, groups };
};

// Get next bill number by finding the highest existing number
const getNextBillNumber = async () => {
  // Find all bills and extract the maximum number
  const bills = await VendorBill.find({ number: { $regex: /^BILL-\d+$/ } }).select('number').lean();
  if (!bills || bills.length === 0) {
    return 'BILL-4001';
  }
  let maxNum = 4000;
  bills.forEach(bill => {
    const match = bill.number?.match(/BILL-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `BILL-${maxNum + 1}`;
};

export const createVendorBill = async ({ vendor, project, amount, purchaseOrder, date, lineItems }, attachmentUrl) => {
  const number = await getNextBillNumber();
  return VendorBill.create({ number, vendor, project, amount, purchaseOrder: purchaseOrder || undefined, lineItems: Array.isArray(lineItems)? lineItems: [], status: 'Pending', date: date ? new Date(date) : new Date(), attachmentUrl });
};

export const setVendorBillPaid = async (id) => {
  const bill = await VendorBill.findById(id);
  if (!bill) { const e = new Error('Vendor Bill not found'); e.status = 404; throw e; }
  const wasPaid = bill.status === 'Paid';
  bill.status = 'Paid';
  await bill.save();
  
  // Update project cost when vendor bill is marked as Paid
  if (!wasPaid && bill.project) {
    const { Project } = await import('../models/Project.js');
    await Project.findByIdAndUpdate(bill.project, { $inc: { cost: bill.amount } });
  }
  
  return bill;
};

export const financeDashboard = async () => {
  const [revAgg, billAgg, expAgg, outInvAgg, outBillAgg] = await Promise.all([
    CustomerInvoice.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    VendorBill.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    CustomerInvoice.aggregate([{ $match: { status: { $ne: 'Paid' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    VendorBill.aggregate([{ $match: { status: { $ne: 'Paid' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const revenue = revAgg[0]?.total || 0;
  const billsCost = billAgg[0]?.total || 0;
  const expensesCost = expAgg[0]?.total || 0;
  const totalCost = billsCost + expensesCost;
  const grossProfit = revenue - totalCost;
  const outstandingPayments = (outInvAgg[0]?.total || 0) + (outBillAgg[0]?.total || 0);

  const costVsRevenueByProject = await Promise.all([
    CustomerInvoice.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: '$project', revenue: { $sum: '$amount' } } }]),
    VendorBill.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: '$project', cost: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$project', cost: { $sum: '$amount' } } }]),
  ]).then(([rev, bills, exps]) => {
    const map = new Map();
    for (const r of rev) map.set(String(r._id), { project: r._id, revenue: r.revenue, cost: 0 });
    for (const b of bills) {
      const key = String(b._id);
      const entry = map.get(key) || { project: b._id, revenue: 0, cost: 0 };
      entry.cost += b.cost;
      map.set(key, entry);
    }
    for (const e of exps) {
      const key = String(e._id);
      const entry = map.get(key) || { project: e._id, revenue: 0, cost: 0 };
      entry.cost += e.cost;
      map.set(key, entry);
    }
    return Array.from(map.values());
  });

  const vendorSpend = await VendorBill.aggregate([
    { $group: { _id: '$vendor', amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
  ]);

  return { revenue, totalCost, grossProfit, outstandingPayments, costVsRevenueByProject, vendorSpend };
};
