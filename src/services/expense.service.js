import { Expense } from '../models/Expense.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { Project } from '../models/Project.js';
import mongoose from 'mongoose';

export const createExpense = async (userId, { project, description, amount, billable }, receiptUrl) => {
  const exp = await Expense.create({ project, description, amount, billable, submittedBy: userId, receiptUrl });
  return exp;
};

export const listExpenses = async (user, { project, status, from, to, search } = {}) => {
  const q = {};
  if (project) q.project = new mongoose.Types.ObjectId(project);
  if (status) q.status = Array.isArray(status) ? { $in: status } : status;
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
  // For simplicity: Admin/PM see all; others see own submissions
  if (!(user.role === 'Admin' || user.role === 'Project Manager')) q.submittedBy = user.id;
  let rows = await Expense.find(q)
    .populate('project', 'name')
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(r => [r.description, r.project?.name, r.submittedBy?.name].some(v => (v||'').toString().toLowerCase().includes(s)));
  }
  // Provide frontend-friendly aliases: expenseName (description) and date (createdAt)
  return rows.map(r => ({
    ...r,
    expenseName: r.description,
    date: r.createdAt,
  }));
};

export const setStatus = async (id, status) => {
  const exp = await Expense.findById(id);
  if (!exp) { const e = new Error('Expense not found'); e.status = 404; throw e; }
  const wasApproved = exp.status === 'approved';
  exp.status = status;
  await exp.save();
  
  // Update project cost when expense is approved
  if (status === 'approved' && !wasApproved && exp.project) {
    const { Project } = await import('../models/Project.js');
    await Project.findByIdAndUpdate(exp.project, { $inc: { cost: exp.amount } });
  }
  // Decrement project cost if expense is rejected after being approved
  else if (status !== 'approved' && wasApproved && exp.project) {
    const { Project } = await import('../models/Project.js');
    await Project.findByIdAndUpdate(exp.project, { $inc: { cost: -exp.amount } });
  }
  
  return exp;
};

// Attach approved billable expense to a draft invoice (aggregate amount)
export const maybeAttachToInvoice = async (expense) => {
  if (!expense || expense.status !== 'approved' || !expense.billable || expense.billed) return expense;
  // Find existing draft invoice for project, else create one using project.client as customer fallback
  let invoice = await CustomerInvoice.findOne({ project: expense.project, status: 'Draft' });
  if (!invoice) {
    const proj = await Project.findById(expense.project).lean();
    const customer = proj?.client || 'Client';
    // Generate new invoice via counter logic reusing finance service number sequence if possible. Fallback simple prefix here.
    // We cannot easily import finance counter; generate timestamp-based unique number.
    const number = 'INVX-' + Date.now();
    invoice = await CustomerInvoice.create({ number, customer, project: expense.project, amount: 0, status: 'Draft', date: new Date() });
  }
  
  // Add expense as line item with project link (per problem statement)
  if (!invoice.lineItems) invoice.lineItems = [];
  invoice.lineItems.push({
    description: expense.description,
    quantity: 1,
    unitPrice: expense.amount,
    taxRate: 0,
    total: expense.amount,
    project: expense.project, // Link back to Project
    sourceExpense: expense._id, // Link back to Expense
  });
  invoice.amount += expense.amount;
  await invoice.save();
  expense.billed = true;
  expense.billedAt = new Date();
  expense.invoice = invoice._id;
  await expense.save();
  return expense;
};

export const reimburse = async (id) => {
  const exp = await Expense.findById(id);
  if (!exp) { const e = new Error('Expense not found'); e.status = 404; throw e; }
  exp.reimbursed = true;
  exp.reimbursedAt = new Date();
  await exp.save();
  return exp;
};

export const dashboardKPIs = async (user) => {
  const q = {};
  if (!(user.role === 'Admin' || user.role === 'Project Manager')) q.submittedBy = user.id;
  const [totalAgg, approvedAgg, billableAgg, reimbursedAgg] = await Promise.all([
    Expense.aggregate([{ $match: q }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { ...q, status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { ...q, billable: true } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { ...q, reimbursed: true } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const total = totalAgg[0]?.total || 0;
  const approved = approvedAgg[0]?.total || 0;
  const billable = billableAgg[0]?.total || 0;
  const reimbursed = reimbursedAgg[0]?.total || 0;
  return {
    totalExpenses: total,
    approvedPercent: total ? approved / total : 0,
    billablePercent: total ? billable / total : 0,
    reimbursedPercent: total ? reimbursed / total : 0,
  };
};

export const expensesByProject = async (user) => {
  const q = {};
  if (!(user.role === 'Admin' || user.role === 'Project Manager')) q.submittedBy = user.id;
  const rows = await Expense.aggregate([
    { $match: q },
    { $group: { _id: '$project', amount: { $sum: '$amount' } } },
    { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, projectId: '$_id', projectName: '$project.name', amount: 1 } },
    { $sort: { amount: -1 } },
  ]);
  return rows;
};
