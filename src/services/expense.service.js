import { Expense } from '../models/Expense.js';
import mongoose from 'mongoose';

export const createExpense = async (userId, { project, description, amount, billable }, receiptUrl) => {
  const exp = await Expense.create({ project, description, amount, billable, submittedBy: userId, receiptUrl });
  return exp;
};

export const listExpenses = async (user, { project } = {}) => {
  const q = {};
  if (project) q.project = new mongoose.Types.ObjectId(project);
  // For simplicity: Admin/PM see all; others see own submissions
  if (!(user.role === 'Admin' || user.role === 'Project Manager')) q.submittedBy = user.id;
  const rows = await Expense.find(q)
    .populate('project', 'name')
    .populate('submittedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
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
  exp.status = status;
  await exp.save();
  return exp;
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
