import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Timesheet } from '../models/Timesheet.js';
import { Expense } from '../models/Expense.js';
import { BillingRecord } from '../models/BillingRecord.js';
import { LinkedDoc } from '../models/LinkedDoc.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { VendorBill } from '../models/VendorBill.js';

const isAdmin = (user) => user?.role === 'Admin';

const pmScopeQuery = (user) => {
  if (isAdmin(user)) return {};
  const uid = new mongoose.Types.ObjectId(user.id);
  // Allow PMs to see projects they manage OR are part of as a team member (backfill older data)
  return { $or: [ { manager: uid }, { teamMembers: uid } ] };
};

export const getDashboard = async (user) => {
  const scope = pmScopeQuery(user);
  const [activeProjects, hoursLoggedAgg, pendingApprovals] = await Promise.all([
    Project.countDocuments({ ...scope, status: 'active' }),
    Timesheet.aggregate([
      { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { $or: [
        { 'p.manager': user.id ? new mongoose.Types.ObjectId(user.id) : undefined },
        { 'p.teamMembers': user.id ? new mongoose.Types.ObjectId(user.id) : undefined }
      ] } },
      { $group: { _id: null, hours: { $sum: '$hours' } } },
    ]),
    Expense.countDocuments({ status: 'pending', ...scope }),
  ]);

  const projectIds = await Project.find(scope).distinct('_id');
  // Revenue from Paid invoices; Costs from Paid vendor bills + approved expenses
  const revenueAgg = await CustomerInvoice.aggregate([
    { $match: { project: { $in: projectIds }, status: 'Paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const billsAgg = await VendorBill.aggregate([
    { $match: { project: { $in: projectIds }, status: 'Paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const approvedExpAgg = await Expense.aggregate([
    { $match: { project: { $in: projectIds }, status: 'approved' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalExpenses = (billsAgg[0]?.total || 0) + (approvedExpAgg[0]?.total || 0);
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
  const projects = await Project.find(query).populate('manager', 'name email').lean();
  // Fallback: if none found and user is PM, attempt legacy manager-only filter (in case $or index mismatch temporarily)
  if (!projects.length && !isAdmin(user)) {
    const legacy = await Project.find({ manager: new mongoose.Types.ObjectId(user.id) }).populate('manager', 'name email').lean();
    return legacy;
  }
  return projects;
};

export const createProject = async (payload) => {
  // Ensure new projects start as active by default so KPIs reflect immediately
  const defaults = { status: 'active', startDate: new Date() };
  // Guarantee manager is part of teamMembers for visibility/backward compatibility
  const managerId = payload.manager ? new mongoose.Types.ObjectId(payload.manager) : null;
  let teamMembers = Array.isArray(payload.teamMembers) ? payload.teamMembers.map(id => new mongoose.Types.ObjectId(id)) : [];
  if (managerId && !teamMembers.find(tm => String(tm) === String(managerId))) {
    teamMembers.push(managerId);
  }
  const p = await Project.create({ ...defaults, ...payload, teamMembers });
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

  const [tasksCount, tasksDone] = await Promise.all([
    Task.countDocuments({ project: project._id }),
    Task.countDocuments({ project: project._id, status: 'done' }),
  ]);
  // Use project's stored revenue/cost fields (updated when invoices/bills/expenses are paid/approved)
  // Fallback to BillingRecord aggregation for backward compatibility
  const revenue = project.revenue || 0;
  const cost = project.cost || 0;
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

export const getTaskDetail = async (taskId) => {
  const t = await Task.findById(taskId)
    .populate('assignee', 'name email')
    .populate('comments.user', 'name email')
    .lean();
  if(!t){ const e = new Error('Task not found'); e.status=404; throw e; }
  return t;
};

export const listTimesheets = (projectId) => {
  return Timesheet.find({ project: projectId }).populate('user', 'name email').populate('task', 'title').lean();
};

export const logTimesheet = async (payload, user) => {
  const ts = await Timesheet.create({ ...payload, user: payload.user || user.id });
  // Record company cost if hourlyRate is set for the user
  try{
    const { User } = await import('../models/User.js');
    const u = await User.findById(ts.user).select('hourlyRate').lean();
    const rate = Number(u?.hourlyRate || 0);
    if(rate > 0 && ts.project){
      const cost = Number(ts.hours || 0) * rate;
      await BillingRecord.create({ type: 'expense', amount: cost, project: ts.project, date: ts.date, notes: 'Timesheet cost' });
      // Update project cost when timesheet is logged (per problem statement: "Each timesheet is an expense on the company")
      const { Project } = await import('../models/Project.js');
      await Project.findByIdAndUpdate(ts.project, { $inc: { cost: cost } });
    }
  }catch{}
  return ts;
};

export const hoursPerMember = async (projectId) => {
  const agg = await Timesheet.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: '$user', hours: { $sum: '$hours' }, billableHours: { $sum: { $cond: [{ $eq: ['$billable', true] }, '$hours', 0] } }, nonBillableHours: { $sum: { $cond: [{ $eq: ['$billable', false] }, '$hours', 0] } } } },
    { $sort: { hours: -1 } },
  ]);
  // Populate user names
  const userIds = agg.map(u => u._id).filter(Boolean);
  let users = [];
  if (userIds.length) {
    const { User } = await import('../models/User.js');
    users = await User.find({ _id: { $in: userIds } }).select('name email role').lean();
  }
  const userMap = new Map(users.map(u => [String(u._id), u]));
  return agg.map(u => ({
    userId: u._id,
    name: userMap.get(String(u._id))?.name || 'Unknown',
    email: userMap.get(String(u._id))?.email || '',
    role: userMap.get(String(u._id))?.role || '',
    hours: u.hours || 0,
    billableHours: u.billableHours || 0,
    nonBillableHours: u.nonBillableHours || 0,
  }));
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

export const listBilling = async (projectId) => {
  const [invoices, bills, expenses] = await Promise.all([
    CustomerInvoice.find({ project: projectId }).lean(),
    VendorBill.find({ project: projectId }).lean(),
    Expense.find({ project: projectId }).lean(),
  ]);
  const result = [];
  for(const i of invoices){ result.push({ type:'revenue', number: i.number, partner: i.customer, amount: i.amount, status: i.status, date: i.date, _id: i._id }); }
  for(const b of bills){ result.push({ type:'expense', number: b.number, partner: b.vendor, amount: b.amount, status: b.status, date: b.date, _id: b._id }); }
  for(const e of expenses){ result.push({ type:'expense', number: e._id, partner: String(e.submittedBy||'') , amount: e.amount, status: e.status, date: e.createdAt, _id: e._id }); }
  result.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
  return result;
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
  // Also include approved expenses recorded in Expense collection (if finance didn't mirror into billing yet)
  const expMod = (await import('../models/Expense.js')).Expense;
  const expAgg = await expMod.aggregate([
    { $match: { project: { $in: projectIds }, status: { $in: ['approved','reimbursed','pending'] } } },
    { $group: { _id: '$project', total: { $sum: '$amount' } } },
  ]);
  const revenueAgg = await CustomerInvoice.aggregate([
    { $match: { project: { $in: projectIds }, status: 'Paid' } },
    { $group: { _id: '$project', total: { $sum: '$amount' } } },
  ]);

  const costMap = Object.fromEntries(costAgg.map(x => [String(x._id), x.total]));
  for(const e of expAgg){
    const k = String(e._id);
    costMap[k] = (costMap[k] || 0) + (e.total || 0);
  }
  const revMap = Object.fromEntries(revenueAgg.map(x => [String(x._id), x.total]));
  // Dynamic progress based on tasks done vs total (fallback to stored progress field)
  const taskAgg = await Task.aggregate([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } }
  ]);
  const taskMap = Object.fromEntries(taskAgg.map(t => [String(t._id), { total: t.total, done: t.done }]));
  const projectProgress = projects.map(p => {
    const t = taskMap[String(p._id)];
    const progress = t ? (t.total ? (t.done / t.total) * 100 : 0) : (p.progress || 0);
    return { projectId: p._id, name: p.name, progress };
  });
  const costVsRevenue = projects.map(p => ({ projectId: p._id, name: p.name, cost: costMap[String(p._id)] || 0, revenue: revMap[String(p._id)] || 0 }));
  // Utilization: total hours per user / 160 (approx monthly capacity)
  const utilAgg = await Timesheet.aggregate([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: '$user', hours: { $sum: '$hours' }, billableHours: { $sum: { $cond: [{ $eq: ['$billable', true] }, '$hours', 0] } }, nonBillableHours: { $sum: { $cond: [{ $eq: ['$billable', false] }, '$hours', 0] } } } },
  ]);
  const userIds = utilAgg.map(u => u._id);
  let users = [];
  if (userIds.length) {
    // Lazy import to avoid circular deps
    const { User } = await import('../models/User.js');
    users = await User.find({ _id: { $in: userIds } }).select('name').lean();
  }
  const nameMap = Object.fromEntries(users.map(u => [String(u._id), u.name]));
  const utilization = utilAgg.map(u => ({ userId: u._id, name: nameMap[String(u._id)], hours: u.hours, billableHours: u.billableHours, nonBillableHours: u.nonBillableHours, capacity: 160, utilization: Math.min(1, u.hours / 160) }));

  return { projectProgress, costVsRevenue, utilization };
};

export const getKanban = async (projectId, { q, assignee, priority } = {}) => {
  const base = { project: projectId };
  if (assignee) base.assignee = assignee;
  if (priority) base.priority = priority;
  if (q) base.title = { $regex: q, $options: 'i' };
  const tasks = await Task.find(base).populate('assignee', 'name email').populate('project', 'name').sort({ status: 1, order: 1, createdAt: 1 }).lean();
  const columns = { todo: [], 'in-progress': [], blocked: [], review: [], done: [] };
  for (const t of tasks) {
    if (columns[t.status]) {
      columns[t.status].push(t);
    } else {
      // If status doesn't match any column, default to todo
      columns.todo.push(t);
    }
  }
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

export const editComment = async (taskId, commentId, text, userId) => {
  const t = await Task.findById(taskId);
  if (!t) { const e = new Error('Task not found'); e.status = 404; throw e; }
  const c = t.comments.id(commentId);
  if (!c) { const e = new Error('Comment not found'); e.status = 404; throw e; }
  if (String(c.user) !== String(userId)) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  c.text = text;
  await t.save();
  return t;
};

export const deleteComment = async (taskId, commentId, userId) => {
  const t = await Task.findById(taskId);
  if (!t) { const e = new Error('Task not found'); e.status = 404; throw e; }
  const c = t.comments.id(commentId);
  if (!c) { const e = new Error('Comment not found'); e.status = 404; throw e; }
  if (String(c.user) !== String(userId)) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  c.deleteOne();
  await t.save();
  return t;
};
