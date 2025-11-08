import { verifyToken } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      const e = new Error('Unauthorized');
      e.status = 401;
      throw e;
    }
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    err.status = err.status || 401;
    next(err);
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    const e = new Error('Forbidden');
    e.status = 403;
    return next(e);
  }
  next();
};

export const requirePMOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'Project Manager')) {
    const e = new Error('Forbidden');
    e.status = 403;
    return next(e);
  }
  next();
};
