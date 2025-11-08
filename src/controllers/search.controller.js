import { globalSearch } from '../services/search.service.js';

export const search = async (req, res, next) => {
  try { res.json({ success: true, ...(await globalSearch(req.user, req.query)) }); } catch (e) { next(e); }
};
