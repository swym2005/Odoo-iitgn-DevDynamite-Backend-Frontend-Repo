import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { BillingRecord } from '../models/BillingRecord.js';
import { Settings } from '../models/Settings.js';
import { roleRedirect } from '../utils/roles.js';
import bcrypt from 'bcryptjs';

export const getDashboardKPIs = async () => {
  const [totalUsers, activeProjects, revenueAgg, expenseAgg] = await Promise.all([
    User.countDocuments(),
    Project.countDocuments({ status: 'active' }),
    BillingRecord.aggregate([{ $match: { type: 'revenue' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    BillingRecord.aggregate([{ $match: { type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue ? (profit / totalRevenue) : 0;
  return { totalUsers, activeProjects, totalRevenue, totalExpenses, profitMargin };
};

export const listUsers = async () => {
  return User.find().select('-password').lean();
};

export const createUser = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const e = new Error('Email already exists');
    e.status = 400;
    throw e;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role });
  return user.toJSON();
};

export const updateUser = async (userId, updates) => {
  const user = await User.findById(userId);
  if (!user) {
    const e = new Error('User not found');
    e.status = 404;
    throw e;
  }
  if (updates.role) user.role = updates.role;
  if (updates.status) user.status = updates.status;
  await user.save();
  return user.toJSON();
};

export const listProjects = async () => {
  return Project.find().populate('manager', 'name email role status').lean();
};

export const createProject = async (payload) => {
  const project = await Project.create(payload);
  return project;
};

export const getAnalytics = async () => {
  const revenueByMonth = await BillingRecord.aggregate([
    { $match: { type: 'revenue' } },
    { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: '$amount' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const usersByRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { role: '$_id', count: 1, _id: 0 } }
  ]);

  return { revenueByMonth, usersByRole };
};

export const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
};

export const updateSettings = async (updates) => {
  const settings = await getSettings();
  Object.assign(settings, updates);
  await settings.save();
  return settings;
};
