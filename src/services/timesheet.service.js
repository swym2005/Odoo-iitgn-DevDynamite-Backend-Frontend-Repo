import mongoose from 'mongoose';
import { Timesheet } from '../models/Timesheet.js';

const buildQuery = (userId, { from, to, project, task } = {}) => {
  const q = { user: new mongoose.Types.ObjectId(userId) };
  if (project) q.project = new mongoose.Types.ObjectId(project);
  if (task) q.task = new mongoose.Types.ObjectId(task);
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
  }
  return q;
};

export const listMyTimesheets = async (userId, filters = {}) => {
  const q = buildQuery(userId, filters);
  return Timesheet.find(q)
    .populate('project', 'name')
    .populate('task', 'title')
    .sort({ date: -1 })
    .lean();
};

export const logMyTimesheet = async (userId, payload) => {
  return Timesheet.create({ ...payload, user: userId });
};

export const deleteMyTimesheet = async (userId, id) => {
  const res = await Timesheet.deleteOne({ _id: id, user: userId });
  if (res.deletedCount === 0) {
    const e = new Error('Timesheet not found');
    e.status = 404;
    throw e;
  }
  return { ok: true };
};

export const summarizeMyTimesheets = async (userId, filters = {}) => {
  const q = buildQuery(userId, filters);
  const agg = await Timesheet.aggregate([
    { $match: q },
    {
      $group: {
        _id: '$billable',
        hours: { $sum: '$hours' },
      },
    },
  ]);
  let billable = 0, nonBillable = 0;
  for (const row of agg) {
    if (row._id) billable += row.hours; else nonBillable += row.hours;
  }
  const total = billable + nonBillable;
  const billablePct = total ? billable / total : 0;
  const nonBillablePct = total ? nonBillable / total : 0;
  return { totalHours: total, billableHours: billable, nonBillableHours: nonBillable, billablePct, nonBillablePct };
};

export const chartsMyTimesheets = async (userId, filters = {}) => {
  const q = buildQuery(userId, filters);
  const hoursPerDay = await Timesheet.aggregate([
    { $match: q },
    { $group: { _id: { $dateToString: { date: '$date', format: '%Y-%m-%d' } }, hours: { $sum: '$hours' } } },
    { $sort: { _id: 1 } },
  ]);

  const billableBreakdown = await Timesheet.aggregate([
    { $match: q },
    { $group: { _id: '$billable', hours: { $sum: '$hours' } } },
  ]);
  let billable = 0, nonBillable = 0;
  for (const row of billableBreakdown) {
    if (row._id) billable += row.hours; else nonBillable += row.hours;
  }
  return { hoursPerDay, billable: billable, nonBillable: nonBillable };
};

export const overviewMyTimesheets = async (userId) => {
  const hoursPerProject = await Timesheet.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$project', hours: { $sum: '$hours' } } },
    { $sort: { hours: -1 } },
    { $limit: 10 },
  ]);
  
  // Populate project names
  const { Project } = await import('../models/Project.js');
  const projectIds = hoursPerProject.map(h => h._id).filter(Boolean);
  const projects = await Project.find({ _id: { $in: projectIds } }).select('name').lean();
  const projectMap = new Map(projects.map(p => [String(p._id), p.name]));
  
  return {
    hoursPerProject: hoursPerProject.map(h => ({
      projectId: h._id,
      projectName: projectMap.get(String(h._id)) || 'Unknown Project',
      hours: h.hours || 0,
    })),
  };
};