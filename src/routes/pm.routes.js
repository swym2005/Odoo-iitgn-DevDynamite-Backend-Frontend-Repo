import express from 'express';
import { requireAuth, requirePMOrAdmin, requireProjectAccess } from '../middleware/auth.js';
import {
  dashboard,
  projectsGet,
  projectsPost,
  projectDetailGet,
  projectPatch,
  projectDelete,
  tasksGet,
  tasksPost,
  taskPatch,
  taskDetailGet,
  kanbanGet,
  kanbanReorder,
  taskCommentPost,
  taskAttachmentPost,
  taskUpload,
  taskAttachmentUpload,
  taskCommentPatch,
  taskCommentDelete,
  timesheetsGet,
  timesheetsPost,
  timesheetsChart,
  expensesGet,
  expensesPost,
  expenseApprove,
  expenseReject,
  linkedDocsGet,
  linkedDocsPost,
  billingGet,
  invoicePost,
  analyticsGet,
} from '../controllers/pm.controller.js';

const router = express.Router();

router.use(requireAuth, requirePMOrAdmin);

router.get('/dashboard', dashboard);
router.get('/analytics', analyticsGet);

router.get('/project-managers', async (req, res, next) => {
  try {
    const { User } = await import('../models/User.js');
    // For Admin: show all active users (not just Project Managers) so they can assign any user as manager
    // For others: show only Project Managers
    const userRole = req.user?.role;
    const query = userRole === 'Admin' 
      ? { status: 'active' } 
      : { role: 'Project Manager', status: 'active' };
    const managers = await User.find(query).select('_id name email role').lean();
    res.json({ success: true, managers });
  } catch (e) { next(e); }
});

router.get('/users', async (req, res, next) => {
  try {
    const { User } = await import('../models/User.js');
    const users = await User.find({ status: 'active' }).select('_id name email role').lean();
    res.json({ success: true, users });
  } catch (e) { next(e); }
});

router.get('/projects', projectsGet);
router.post('/projects', projectsPost);
router.get('/projects/:projectId', requireProjectAccess, projectDetailGet);
router.patch('/projects/:projectId', requireProjectAccess, projectPatch);
router.delete('/projects/:projectId', requireProjectAccess, projectDelete);

router.get('/projects/:projectId/tasks', requireProjectAccess, tasksGet);
router.post('/projects/:projectId/tasks', requireProjectAccess, tasksPost);
router.patch('/projects/:projectId/tasks/:taskId', requireProjectAccess, taskPatch);
router.get('/tasks/:taskId', taskDetailGet);
router.get('/projects/:projectId/kanban', requireProjectAccess, kanbanGet);
router.post('/projects/:projectId/kanban/reorder', requireProjectAccess, kanbanReorder);
router.post('/projects/:projectId/tasks/:taskId/comments', requireProjectAccess, taskCommentPost);
router.patch('/projects/:projectId/tasks/:taskId/comments/:commentId', requireProjectAccess, taskCommentPatch);
router.delete('/projects/:projectId/tasks/:taskId/comments/:commentId', requireProjectAccess, taskCommentDelete);
router.post('/projects/:projectId/tasks/:taskId/attachments', requireProjectAccess, taskAttachmentPost);
router.post('/projects/:projectId/tasks/:taskId/attachments/upload', taskUpload.single('file'), taskAttachmentUpload);

router.get('/projects/:projectId/timesheets', requireProjectAccess, timesheetsGet);
router.post('/projects/:projectId/timesheets', requireProjectAccess, timesheetsPost);
router.get('/projects/:projectId/timesheets/chart', requireProjectAccess, timesheetsChart);

router.get('/projects/:projectId/expenses', requireProjectAccess, expensesGet);
router.post('/projects/:projectId/expenses', requireProjectAccess, expensesPost);
router.post('/projects/:projectId/expenses/:expenseId/approve', requireProjectAccess, expenseApprove);
router.post('/projects/:projectId/expenses/:expenseId/reject', requireProjectAccess, expenseReject);

router.get('/projects/:projectId/linked-docs', requireProjectAccess, linkedDocsGet);
router.post('/projects/:projectId/linked-docs', requireProjectAccess, linkedDocsPost);

router.get('/projects/:projectId/billing', requireProjectAccess, billingGet);
router.post('/projects/:projectId/billing/invoice', requireProjectAccess, invoicePost);

// Sales Orders access for PM scope and conversion to Invoice
router.get('/projects/:projectId/sales-orders', requireProjectAccess, async (req, res, next) => {
  try {
    const { listSalesOrders } = await import('../services/finance.service.js');
    const result = await listSalesOrders({ project: req.params.projectId });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});
router.post('/sales-orders/:id/convert-invoice', requirePMOrAdmin, async (req, res, next) => {
  try {
    const { SalesOrder } = await import('../models/SalesOrder.js');
    const so = await SalesOrder.findById(req.params.id).select('project');
    if(!so){ const err=new Error('Sales Order not found'); err.status=404; throw err; }
    // Project access check (reuse logic inline)
    const { Project } = await import('../models/Project.js');
    const project = await Project.findById(so.project).select('manager teamMembers');
    if(!project){ const err=new Error('Project not found'); err.status=404; throw err; }
    const isPrivileged = (req.user.role === 'Admin' || req.user.role === 'Project Manager');
    const isManager = String(project.manager) === String(req.user.id);
    const isMember = project.teamMembers.some(tm => String(tm) === String(req.user.id));
    if (!(isPrivileged || isManager || isMember)) { const err=new Error('Forbidden'); err.status=403; throw err; }
    const { createInvoiceFromSalesOrder } = await import('../services/finance.service.js');
    const inv = await createInvoiceFromSalesOrder(req.params.id);
    res.status(201).json({ success:true, invoice: inv });
  } catch (e) { next(e); }
});

export default router;
