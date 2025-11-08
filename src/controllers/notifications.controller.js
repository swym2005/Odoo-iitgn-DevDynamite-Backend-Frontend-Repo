import { listNotifications, markAsRead, unreadCount } from '../services/notifications.service.js';

export const getNotifications = async (req, res, next) => {
  try { res.json({ success: true, items: await listNotifications(req.user, req.query) }); } catch (e) { next(e); }
};

export const markRead = async (req, res, next) => {
  try { res.json({ success: true, ...(await markAsRead(req.user, req.body)) }); } catch (e) { next(e); }
};

export const getUnreadCount = async (req, res, next) => {
  try { res.json({ success: true, ...(await unreadCount(req.user)) }); } catch (e) { next(e); }
};
