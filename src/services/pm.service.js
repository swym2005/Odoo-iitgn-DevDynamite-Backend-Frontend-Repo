import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Timesheet } from '../models/Timesheet.js';
import { Expense } from '../models/Expense.js';
import { BillingRecord } from '../models/BillingRecord.js';
import { LinkedDoc } from '../models/LinkedDoc.js';

const isAdmin = (user) => user?.role === 'Admin';

const pmScopeQuery = (user) => {
  if (isAdmin(user)) return {};
  return { manager: new mongoose.Types.ObjectId(user.id) };
};

export const getDashboard = async (user) => {
  const scope = pmScopeQuery(user);
  const [activeProjects, hoursLoggedAgg, pendingApprovals] = await Promise.all([
    Project.countDocuments({ ...scope, status: 'active' }),
    Timesheet.aggregate([
      { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { 'p.manager': user.id ? new mongoose.Types.ObjectId(user.id) : undefined } },
      { $group: { _id: null, hours: { $sum: '$hours' } } },
    ]),
    Expense.countDocuments({ status: 'pending', ...scope }),
  ]);

  const projectIds = await Project.find(scope).distinct('_id');

  const revenueAgg = await BillingRecord.aggregate([
    { $match: { type: 'revenue', project: { $in: projectIds } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const expenseAgg = await BillingRecord.aggregate([
    { $match: { type: 'expense', project: { $in: projectIds } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;
  const profit = totalRevenue - totalExpenses;
  const profitPercent = totalRevenue ? (profit / totalRevenue) : 0;

  return {
    KPIs: {
      activeProjects,
      hoursLogged: hoursLoggedAgg[0]?.hours || 0,
      pendingApprovals,
      profitPercent,
    },
  };
};

export const listProjects = async (user, { status, from, to } = {}) => {
  const scope = pmScopeQuery(user);
  const query = { ...scope };
  if (status) query.status = status;
  if (from || to) {
    query.deadline = {};
    if (from) query.deadline.$gte = new Date(from);
    if (to) query.deadline.$lte = new Date(to);
  }
  return Project.find(query).lean();
};

export const createProject = async (payload) => {
  // Ensure new projects start as active by default so KPIs reflect immediately
  const defaults = { status: 'active', startDate: new Date() };
  const p = await Project.create({ ...defaults, ...payload });
  return p;
};

export const getProjectDetail = async (user, projectId) => {
  const project = await Project.findById(projectId).populate('manager teamMembers', 'name email role status').lean();
  if (!project) {
    const e = new Error('Project not found');
    e.status = 404;
    throw e;
  }
  // basic access check: admin or manager
  if (!isAdmin(user) && String(project.manager?._id || project.manager) !== user.id) {
    const e = new Error('Forbidden');
    e.status = 403;
    throw e;
  }

  const [tasksCount, tasksDone, revenueAgg, expenseAgg] = await Promise.all([
    Task.countDocuments({ project: project._id }),
    Task.countDocuments({ project: project._id, status: 'done' }),
    BillingRecord.aggregate([{ $match: { project: project._id, type: 'revenue' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    BillingRecord.aggregate([{ $match: { project: project._id, type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const revenue = revenueAgg[0]?.total || 0;
  const cost = expenseAgg[0]?.total || 0;
  const profit = revenue - cost;
  const progress = tasksCount ? Math.round((tasksDone / tasksCount) * 100) : project.progress || 0;

  return { project, summary: { budget: project.budget, revenue, cost, profit, progress } };
};

export const listTasks = (projectId, { status } = {}) => {
  const q = { project: new mongoose.Types.ObjectId(projectId) };
  if (status) q.status = status;
  return Task.find(q).populate('assignee', 'name email').lean();
};

export const addTask = async (payload) => {
  const t = await Task.create(payload);
  return t;
};

export const updateTask = async (taskId, updates) => {
  const t = await Task.findByIdAndUpdate(taskId, updates, { new: true });
  if (!t) {
    const e = new Error('Task not found');
    e.status = 404;
    throw e;
  }
  if (updates.status) {
    t.activity.push({ type: 'status_change', meta: { status: updates.status } });
    await t.save();
  }
  return t;
};

export const listTimesheets = (projectId) => {
  return Timesheet.find({ project: projectId }).populate('user', 'name email').populate('task', 'title').lean();
};

export const logTimesheet = async (payload, user) => {
  const ts = await Timesheet.create({ ...payload, user: payload.user || user.id });
  return ts;
};

export const hoursPerMember = async (projectId) => {
  const agg = await Timesheet.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: '$user', hours: { $sum: '$hours' } } },
  ]);
  return agg;
};

export const listExpenses = (projectId) => {
  return Expense.find({ project: projectId }).populate('submittedBy', 'name email').lean();
};

export const addExpense = async (payload, user) => {
  return Expense.create({ ...payload, submittedBy: payload.submittedBy || user.id });
};

export const setExpenseStatus = async (expenseId, status) => {
  const exp = await Expense.findById(expenseId);
  if (!exp) {
    const e = new Error('Expense not found');
    e.status = 404;
    throw e;
  }
  exp.status = status;
  await exp.save();
  return exp;
};

export const listLinkedDocs = (projectId) => {
  return LinkedDoc.find({ project: projectId }).lean();
};

export const addLinkedDoc = (payload) => LinkedDoc.create(payload);

export const listBilling = (projectId) => {
  return BillingRecord.find({ project: projectId }).lean();
};

export const addBillingRecord = async (projectId, { type, amount, date }) => {
  const rec = await BillingRecord.create({ project: projectId, type, amount, date: date ? new Date(date) : new Date() });
  return rec;
};

export const getPMAnalytics = async (user) => {
  const scope = pmScopeQuery(user);
  const projects = await Project.find(scope).select('_id name progress').lean();
  const projectIds = projects.map(p => p._id);

  const costAgg = await BillingRecord.aggregate([
    { $match: { type: 'expense', project: { $in: projectIds } } },
    { $group: { _id: '$project', total: { $sum: '$amount' } } },
  ]);
  const revenueAgg = await BillingRecord.aggregate([
    { $match: { type: 'revenue', project: { $in: projectIds } } },
    { $group: { _id: '$project', total: { $sum: '$amount' } } },
  ]);

  const costMap = Object.fromEntries(costAgg.map(x => [String(x._id), x.total]));
  const revMap = Object.fromEntries(revenueAgg.map(x => [String(x._id), x.total]));

  const projectProgress = projects.map(p => ({ projectId: p._id, name: p.name, progress: p.progress || 0 }));
  const costVsRevenue = projects.map(p => ({ projectId: p._id, name: p.name, cost: costMap[String(p._id)] || 0, revenue: revMap[String(p._id)] || 0 }));

  // Utilization: total hours per user / 160 (approx monthly capacity)
  const utilAgg = await Timesheet.aggregate([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: '$user', hours: { $sum: '$hours' } } },
  ]);
  const utilization = utilAgg.map(u => ({ userId: u._id, hours: u.hours, capacity: 160, utilization: Math.min(1, u.hours / 160) }));

  return { projectProgress, costVsRevenue, utilization };
};

export const getKanban = async (projectId, { q, assignee, priority } = {}) => {
  const base = { project: projectId };
  if (assignee) base.assignee = assignee;
  if (priority) base.priority = priority;
  if (q) base.title = { $regex: q, $options: 'i' };
  const tasks = await Task.find(base).populate('assignee', 'name email').sort({ status: 1, order: 1, createdAt: 1 }).lean();
  const columns = { todo: [], 'in-progress': [], blocked: [], review: [], done: [] };
  for (const t of tasks) columns[t.status]?.push(t);
  return columns;
};

export const reorderTask = async ({ taskId, from, to, userId }) => {
  const task = await Task.findById(taskId);
  if (!task) { const e = new Error('Task not found'); e.status = 404; throw e; }
  const fromStatus = from.status;
  const toStatus = to.status;

  // Adjust orders in source column
  await Task.updateMany({ project: task.project, status: fromStatus, order: { $gt: from.index } }, { $inc: { order: -1 } });

  // Make room in destination column
  await Task.updateMany({ project: task.project, status: toStatus, order: { $gte: to.index } }, { $inc: { order: 1 } });

  task.status = toStatus;
  task.order = to.index;
  task.activity.push({ user: userId, type: 'update', meta: { action: 'reorder', from, to } });
  await task.save();
  return task;
};

export const addComment = async (taskId, { text }, userId) => {
  const t = await Task.findById(taskId);
  if (!t) { const e = new Error('Task not found'); e.status = 404; throw e; }
  t.comments.push({ user: userId, text, createdAt: new Date() });
  t.activity.push({ user: userId, type: 'comment', meta: { text } });
  await t.save();
  return t;
};

export const addAttachment = async (taskId, file, userId) => {
  const t = await Task.findById(taskId);
  if (!t) { const e = new Error('Task not found'); e.status = 404; throw e; }
  t.attachments.push({ ...file, addedBy: userId, addedAt: new Date() });
  t.activity.push({ user: userId, type: 'attachment', meta: { name: file.name, url: file.url } });
  await t.save();
  return t;
};
