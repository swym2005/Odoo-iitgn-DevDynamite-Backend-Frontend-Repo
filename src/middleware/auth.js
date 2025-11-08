import { verifyToken } from '../utils/jwt.js';
import { Project } from '../models/Project.js';

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

export const requireFinanceOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'Finance')) {
    const e = new Error('Forbidden');
    e.status = 403;
    return next(e);
  }
  next();
};

// Require the authenticated user to have access to a specific project.
// Access granted if user is Admin / Project Manager OR user id appears in project.teamMembers OR user is project.manager.
// Project ID is resolved from: req.params.projectId || req.body.project || req.query.projectId
export const requireProjectAccess = async (req, res, next) => {
  try {
    if (!req.user) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
    const pid = req.params.projectId || req.body.project || req.query.projectId;
    if (!pid) { const e = new Error('Project ID required'); e.status = 400; throw e; }
    const project = await Project.findById(pid).select('manager teamMembers');
    if (!project) { const e = new Error('Project not found'); e.status = 404; throw e; }
    const isPrivileged = (req.user.role === 'Admin' || req.user.role === 'Project Manager');
    const isManager = String(project.manager) === String(req.user.id);
    const isMember = project.teamMembers.some(tm => String(tm) === String(req.user.id));
    if (!(isPrivileged || isManager || isMember)) {
      const e = new Error('Forbidden'); e.status = 403; throw e;
    }
    // Attach project for downstream handlers if needed
    req.project = project;
    next();
  } catch (err) { next(err); }
};
