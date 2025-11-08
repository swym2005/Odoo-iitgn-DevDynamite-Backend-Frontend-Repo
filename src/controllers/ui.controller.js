import { getMenuForRole } from '../services/ui.service.js';

export const getMenu = async (req, res, next) => {
  try { res.json({ success: true, items: getMenuForRole(req.user.role) }); } catch (e) { next(e); }
};
