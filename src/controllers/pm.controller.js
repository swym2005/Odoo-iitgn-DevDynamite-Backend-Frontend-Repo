import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  logTimesheetSchema,
  expenseCreateSchema,
  expenseStatusSchema,
  linkDocSchema,
} from '../validators/pm.validators.js';

import {
  getDashboard,
  listProjects,
  createProject,
  getProjectDetail,
  listTasks,
  addTask,
  updateTask,
  listTimesheets,
  logTimesheet,
  hoursPerMember,
  listExpenses,
  addExpense,
  setExpenseStatus,
  listLinkedDocs,
  addLinkedDoc,
  listBilling,
  addBillingRecord,
  getPMAnalytics,
} from '../services/pm.service.js';

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) {
    const e = new Error(error.details.map(d => d.message).join(', '));
    e.status = 400;
    throw e;
  }
  return value;
};

export const dashboard = async (req, res, next) => {
  try { res.json({ success: true, ...(await getDashboard(req.user)) }); } catch (e) { next(e); }
};

export const projectsGet = async (req, res, next) => {
  try { res.json({ success: true, projects: await listProjects(req.user, req.query) }); } catch (e) { next(e); }
};

export const projectsPost = async (req, res, next) => {
  try {
    const data = validate(createProjectSchema, req.body);
    res.status(201).json({ success: true, project: await createProject(data) });
  } catch (e) { next(e); }
};

export const projectDetailGet = async (req, res, next) => {
  try { res.json({ success: true, ...(await getProjectDetail(req.user, req.params.projectId)) }); } catch (e) { next(e); }
};

export const projectPatch = async (req, res, next) => {
  try {
    const data = validate(updateProjectSchema, req.body);
    const update = await (await import('../models/Project.js')).Project.findByIdAndUpdate(req.params.projectId, data, { new: true });
    if (!update) { const err = new Error('Project not found'); err.status = 404; throw err; }
    res.json({ success: true, project: update });
  } catch (e) { next(e); }
};

export const tasksGet = async (req, res, next) => {
  try { res.json({ success: true, tasks: await listTasks(req.params.projectId, req.query) }); } catch (e) { next(e); }
};

export const tasksPost = async (req, res, next) => {
  try { const data = validate(createTaskSchema, { ...req.body, project: req.params.projectId }); res.status(201).json({ success: true, task: await addTask(data) }); } catch (e) { next(e); }
};

export const taskPatch = async (req, res, next) => {
  try { const data = validate(updateTaskSchema, req.body); res.json({ success: true, task: await updateTask(req.params.taskId, data) }); } catch (e) { next(e); }
};

export const timesheetsGet = async (req, res, next) => {
  try { res.json({ success: true, timesheets: await listTimesheets(req.params.projectId) }); } catch (e) { next(e); }
};

export const timesheetsPost = async (req, res, next) => {
  try { const data = validate(logTimesheetSchema, { ...req.body, project: req.params.projectId }); res.status(201).json({ success: true, timesheet: await logTimesheet(data, req.user) }); } catch (e) { next(e); }
};

export const timesheetsChart = async (req, res, next) => {
  try { res.json({ success: true, hoursPerMember: await hoursPerMember(req.params.projectId) }); } catch (e) { next(e); }
};

export const expensesGet = async (req, res, next) => {
  try { res.json({ success: true, expenses: await listExpenses(req.params.projectId) }); } catch (e) { next(e); }
};

export const expensesPost = async (req, res, next) => {
  try { const data = validate(expenseCreateSchema, { ...req.body, project: req.params.projectId }); res.status(201).json({ success: true, expense: await addExpense(data, req.user) }); } catch (e) { next(e); }
};

export const expenseApprove = async (req, res, next) => {
  try { res.json({ success: true, expense: await setExpenseStatus(req.params.expenseId, 'approved') }); } catch (e) { next(e); }
};

export const expenseReject = async (req, res, next) => {
  try { res.json({ success: true, expense: await setExpenseStatus(req.params.expenseId, 'rejected') }); } catch (e) { next(e); }
};

export const linkedDocsGet = async (req, res, next) => {
  try { res.json({ success: true, linkedDocs: await listLinkedDocs(req.params.projectId) }); } catch (e) { next(e); }
};

export const linkedDocsPost = async (req, res, next) => {
  try { const data = validate(linkDocSchema, { ...req.body, project: req.params.projectId }); res.status(201).json({ success: true, linkedDoc: await addLinkedDoc(data) }); } catch (e) { next(e); }
};

export const billingGet = async (req, res, next) => {
  try { res.json({ success: true, billing: await listBilling(req.params.projectId) }); } catch (e) { next(e); }
};

export const invoicePost = async (req, res, next) => {
  try { const { amount, date } = req.body; res.status(201).json({ success: true, record: await addBillingRecord(req.params.projectId, { type: 'revenue', amount, date }) }); } catch (e) { next(e); }
};

export const analyticsGet = async (req, res, next) => {
  try { res.json({ success: true, ...(await getPMAnalytics(req.user)) }); } catch (e) { next(e); }
};
