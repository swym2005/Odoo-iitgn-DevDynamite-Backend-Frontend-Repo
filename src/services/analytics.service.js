import mongoose from 'mongoose';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { VendorBill } from '../models/VendorBill.js';
import { Expense } from '../models/Expense.js';
import { Timesheet } from '../models/Timesheet.js';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const dateMatch = (from, to, field = 'date') => {
  const m = {};
  if (from) m.$gte = new Date(from);
  if (to) m.$lte = new Date(to);
  return Object.keys(m).length ? { [field]: m } : {};
};

export const overviewAnalytics = async (user, { from, to, project, role } = {}) => {
  // Scope: Admin sees all; PM sees projects they manage; others restricted – keep Admin/PM usage intended for analytics
  const projectMatch = project ? { project: toObjectId(project) } : {};

  // Revenue Growth (line) by month
  const revGrowth = await CustomerInvoice.aggregate([
    { $match: { status: 'Paid', ...projectMatch, ...dateMatch(from, to, 'date') } },
    { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, revenue: { $sum: '$amount' } } },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, revenue: r.revenue })));

  // Cost vs Revenue (stacked bar) by project
  const [revByProject, billByProject, expByProject] = await Promise.all([
    CustomerInvoice.aggregate([
      { $match: { status: 'Paid', ...projectMatch, ...dateMatch(from, to, 'date') } },
      { $group: { _id: '$project', revenue: { $sum: '$amount' } } },
    ]),
    VendorBill.aggregate([
      { $match: { status: 'Paid', ...projectMatch, ...dateMatch(from, to, 'date') } },
      { $group: { _id: '$project', cost: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { status: 'approved', ...projectMatch, ...dateMatch(from, to, 'createdAt') } },
      { $group: { _id: '$project', cost: { $sum: '$amount' } } },
    ]),
  ]);
  const barMap = new Map();
  for (const r of revByProject) barMap.set(String(r._id), { projectId: r._id, revenue: r.revenue, cost: 0 });
  for (const b of billByProject) {
    const key = String(b._id);
    const e = barMap.get(key) || { projectId: b._id, revenue: 0, cost: 0 };
    e.cost += b.cost;
    barMap.set(key, e);
  }
  for (const e of expByProject) {
    const key = String(e._id);
    const it = barMap.get(key) || { projectId: e._id, revenue: 0, cost: 0 };
    it.cost += e.cost;
    barMap.set(key, it);
  }
  const costVsRevenue = await Project.aggregate([
    { $match: project ? { _id: toObjectId(project) } : {} },
    { $project: { name: 1 } },
  ]).then(projects => projects.map(p => ({
    projectId: p._id,
    projectName: p.name,
    revenue: barMap.get(String(p._id))?.revenue || 0,
    cost: barMap.get(String(p._id))?.cost || 0,
  })));

  // Task Completion % (pie) – current state within optional project filter
  const [tasksTotal, tasksDone] = await Promise.all([
    Task.countDocuments({ ...(project ? { project } : {}) }),
    Task.countDocuments({ status: 'done', ...(project ? { project } : {}) }),
  ]);
  const taskCompletion = {
    done: tasksDone,
    remaining: Math.max(0, tasksTotal - tasksDone),
  };

  // Team Utilization (radar) – hours per user within date range and (optional) role filter
  let tsMatch = { ...dateMatch(from, to, 'date'), ...(project ? { project: toObjectId(project) } : {}) };
  const utilAgg = await Timesheet.aggregate([
    { $match: tsMatch },
    { $group: { _id: '$user', hours: { $sum: '$hours' } } },
    { $sort: { hours: -1 } },
  ]);
  const userIds = utilAgg.map(u => u._id);
  let users = [];
  if (userIds.length) {
    const roleMatch = role ? { role } : {};
    users = await User.find({ _id: { $in: userIds }, ...roleMatch }).select('name email role').lean();
  }
  const userMap = new Map(users.map(u => [String(u._id), u]));
  const utilization = utilAgg
    .filter(u => !role || userMap.has(String(u._id)))
    .map(u => ({
      userId: u._id,
      name: userMap.get(String(u._id))?.name || 'Unknown',
      role: userMap.get(String(u._id))?.role,
      hours: u.hours,
      capacity: 160,
      utilization: Math.min(1, u.hours / 160),
    }));

  // KPIs
  const [revAgg, billAgg, expAgg, hoursAgg] = await Promise.all([
    CustomerInvoice.aggregate([{ $match: { status: 'Paid', ...projectMatch, ...dateMatch(from, to, 'date') } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    VendorBill.aggregate([{ $match: { status: 'Paid', ...projectMatch, ...dateMatch(from, to, 'date') } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { status: 'approved', ...projectMatch, ...dateMatch(from, to, 'createdAt') } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Timesheet.aggregate([{ $match: tsMatch }, { $group: { _id: null, hours: { $sum: '$hours' } } }]),
  ]);
  const revenue = revAgg[0]?.total || 0;
  const cost = (billAgg[0]?.total || 0) + (expAgg[0]?.total || 0);
  const hoursLogged = hoursAgg[0]?.hours || 0;
  const avgProfitMargin = revenue ? (revenue - cost) / revenue : 0;
  const expenseRatio = revenue ? (expAgg[0]?.total || 0) / revenue : 0;

  return {
    charts: {
      revenueGrowth: revGrowth,
      costVsRevenue,
      taskCompletion,
      utilization,
    },
    filters: { from, to, project, role },
    kpis: { totalRevenue: revenue, avgProfitMargin, hoursLogged, expenseRatio },
  };
};

export const projectAnalytics = async (user, projectId, { from, to } = {}) => {
  const pid = toObjectId(projectId);

  // Timeline: tasks created vs done per month in range
  const tasksCreated = await Task.aggregate([
    { $match: { project: pid, ...dateMatch(from, to, 'createdAt') } },
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, created: { $sum: 1 } } },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, created: r.created })));
  const tasksDone = await Task.aggregate([
    { $match: { project: pid, status: 'done', ...dateMatch(from, to, 'updatedAt') } },
    { $group: { _id: { y: { $year: '$updatedAt' }, m: { $month: '$updatedAt' } }, done: { $sum: 1 } } },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, done: r.done })));
  // Merge timeline
  const timeMap = new Map();
  for (const c of tasksCreated) timeMap.set(c.label, { label: c.label, created: c.created, done: 0 });
  for (const d of tasksDone) timeMap.set(d.label, { ...(timeMap.get(d.label) || { label: d.label, created: 0 }), done: d.done });
  const timeline = Array.from(timeMap.values()).sort((a,b) => a.label.localeCompare(b.label));

  // Revenue vs Cost over time (by month)
  const revByMonth = await CustomerInvoice.aggregate([
    { $match: { status: 'Paid', project: pid, ...dateMatch(from, to, 'date') } },
    { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, revenue: { $sum: '$amount' } } },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, revenue: r.revenue })));
  const costBills = await VendorBill.aggregate([
    { $match: { status: 'Paid', project: pid, ...dateMatch(from, to, 'date') } },
    { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, cost: { $sum: '$amount' } } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, cost: r.cost })));
  const costExp = await Expense.aggregate([
    { $match: { status: 'approved', project: pid, ...dateMatch(from, to, 'createdAt') } },
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, cost: { $sum: '$amount' } } },
  ]).then(rows => rows.map(r => ({ label: `${r._id.y}-${String(r._id.m).padStart(2,'0')}`, cost: r.cost })));
  const costMap = new Map();
  for (const c of costBills) costMap.set(c.label, { label: c.label, cost: c.cost });
  for (const c of costExp) costMap.set(c.label, { label: c.label, cost: (costMap.get(c.label)?.cost || 0) + c.cost });
  const revCostLabels = new Set([...revByMonth.map(r => r.label), ...Array.from(costMap.keys())]);
  const revenueVsCost = Array.from(revCostLabels).sort().map(label => ({
    label,
    revenue: revByMonth.find(r => r.label === label)?.revenue || 0,
    cost: costMap.get(label)?.cost || 0,
  }));

  // Completion gauge
  const [totalTasks, doneTasks] = await Promise.all([
    Task.countDocuments({ project: pid }),
    Task.countDocuments({ project: pid, status: 'done' }),
  ]);
  const completion = totalTasks ? (doneTasks / totalTasks) : 0;

  return { timeline, revenueVsCost, completion };
};

export const overviewReportCSV = async (user, filters) => {
  const data = await overviewAnalytics(user, filters);
  const lines = [];
  lines.push('KPI,Value');
  lines.push(`Total Revenue,${data.kpis.totalRevenue}`);
  lines.push(`Avg Profit Margin,${(data.kpis.avgProfitMargin*100).toFixed(2)}%`);
  lines.push(`Hours Logged,${data.kpis.hoursLogged}`);
  lines.push(`Expense Ratio,${(data.kpis.expenseRatio*100).toFixed(2)}%`);
  lines.push('');
  lines.push('Project,Revenue,Cost');
  for (const row of data.charts.costVsRevenue) lines.push(`${row.projectName},${row.revenue},${row.cost}`);
  return lines.join('\n');
};

export const projectReportCSV = async (user, projectId, filters) => {
  const data = await projectAnalytics(user, projectId, filters);
  const lines = [];
  lines.push('Label,Revenue,Cost');
  for (const row of data.revenueVsCost) lines.push(`${row.label},${row.revenue},${row.cost}`);
  lines.push('');
  lines.push(`Completion,${(data.completion*100).toFixed(2)}%`);
  return lines.join('\n');
};
