import express from 'express';
import { requireAuth, requirePMOrAdmin } from '../middleware/auth.js';
import {
  dashboard,
  projectsGet,
  projectsPost,
  projectDetailGet,
  projectPatch,
  tasksGet,
  tasksPost,
  taskPatch,
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

router.get('/projects', projectsGet);
router.post('/projects', projectsPost);
router.get('/projects/:projectId', projectDetailGet);
router.patch('/projects/:projectId', projectPatch);

router.get('/projects/:projectId/tasks', tasksGet);
router.post('/projects/:projectId/tasks', tasksPost);
router.patch('/projects/:projectId/tasks/:taskId', taskPatch);

router.get('/projects/:projectId/timesheets', timesheetsGet);
router.post('/projects/:projectId/timesheets', timesheetsPost);
router.get('/projects/:projectId/timesheets/chart', timesheetsChart);

router.get('/projects/:projectId/expenses', expensesGet);
router.post('/projects/:projectId/expenses', expensesPost);
router.post('/projects/:projectId/expenses/:expenseId/approve', expenseApprove);
router.post('/projects/:projectId/expenses/:expenseId/reject', expenseReject);

router.get('/projects/:projectId/linked-docs', linkedDocsGet);
router.post('/projects/:projectId/linked-docs', linkedDocsPost);

router.get('/projects/:projectId/billing', billingGet);
router.post('/projects/:projectId/billing/invoice', invoicePost);

export default router;
