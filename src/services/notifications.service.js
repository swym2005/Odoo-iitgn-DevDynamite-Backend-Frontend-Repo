import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';

export const createNotification = async ({ user, audienceRole, project, type, title, message, link, meta }) => {
  const doc = await Notification.create({
    user: user ? new mongoose.Types.ObjectId(user) : undefined,
    audienceRole,
    project: project ? new mongoose.Types.ObjectId(project) : undefined,
    type,
    title,
    message,
    link,
    meta,
  });
  return doc;
};

export const listNotifications = async (currentUser, { limit = 20, before } = {}) => {
  const q = { $or: [{ user: currentUser.id }, { audienceRole: currentUser.role }] };
  if (before) q.createdAt = { $lt: new Date(before) };
  return Notification.find(q).sort({ createdAt: -1 }).limit(Math.min(100, Number(limit) || 20)).lean();
};

export const markAsRead = async (currentUser, { ids, all } = {}) => {
  const q = { $or: [{ user: currentUser.id }, { audienceRole: currentUser.role }] };
  if (all) {
    await Notification.updateMany({ ...q, read: false }, { $set: { read: true } });
    return { updated: 'all' };
  }
  const idList = (ids || []).map(id => new mongoose.Types.ObjectId(id));
  const res = await Notification.updateMany({ ...q, _id: { $in: idList } }, { $set: { read: true } });
  return { matched: res.matchedCount || res.n, modified: res.modifiedCount || res.nModified };
};

export const unreadCount = async (currentUser) => {
  const q = { read: false, $or: [{ user: currentUser.id }, { audienceRole: currentUser.role }] };
  const count = await Notification.countDocuments(q);
  return { count };
};
