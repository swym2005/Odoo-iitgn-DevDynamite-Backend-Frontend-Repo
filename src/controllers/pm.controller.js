import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  logTimesheetSchema,
  expenseCreateSchema,
  expenseStatusSchema,
  linkDocSchema,
  reorderTasksSchema,
  addCommentSchema,
  addAttachmentSchema,
} from '../validators/pm.validators.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import {
  getDashboard,
  listProjects,
  createProject,
  getProjectDetail,
  listTasks,
  addTask,
  updateTask,
  getTaskDetail,
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
  getKanban,
  reorderTask,
  addComment,
  addAttachment,
  editComment,
  deleteComment,
} from '../services/pm.service.js';
import { createNotification } from '../services/notifications.service.js';

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
    // Auto-inject current user as manager if not provided (frontend omits it)
    const incoming = { ...req.body };
    if (!incoming.manager) incoming.manager = req.user.id; // ensure manager present
    // Basic safety: only Admin can set a different manager manually
    if (incoming.manager !== req.user.id && req.user.role !== 'Admin') {
      incoming.manager = req.user.id;
    }
    // Optional: accept comma separated emails for team assignment (teamEmails)
    if (incoming.teamEmails && typeof incoming.teamEmails === 'string') {
      const emails = incoming.teamEmails.split(',').map(e => String(e).trim().toLowerCase()).filter(Boolean);
      if (emails.length) {
        try {
          const { User } = await import('../models/User.js');
          const found = await User.find({ email: { $in: emails }, status: 'active' }).select('_id').lean();
          incoming.teamMembers = Array.from(new Set([...(incoming.teamMembers||[]), ...found.map(f => String(f._id))]));
        } catch {}
      }
      delete incoming.teamEmails;
    }
    const data = validate(createProjectSchema, incoming);
    const project = await createProject(data);
    res.status(201).json({ success: true, project });
  } catch (e) { next(e); }
};

export const projectDetailGet = async (req, res, next) => {
  try { res.json({ success: true, ...(await getProjectDetail(req.user, req.params.projectId)) }); } catch (e) { next(e); }
};

export const kanbanGet = async (req, res, next) => {
  try { res.json({ success: true, columns: await getKanban(req.params.projectId, req.query) }); } catch (e) { next(e); }
};

export const kanbanReorder = async (req, res, next) => {
  try { const data = validate(reorderTasksSchema, req.body); res.json({ success: true, task: await reorderTask({ ...data, userId: req.user.id }) }); } catch (e) { next(e); }
};

export const taskCommentPost = async (req, res, next) => {
  try { const data = validate(addCommentSchema, req.body); res.status(201).json({ success: true, task: await addComment(req.params.taskId, data, req.user.id) }); } catch (e) { next(e); }
};

export const taskAttachmentPost = async (req, res, next) => {
  try { const data = validate(addAttachmentSchema, req.body); res.status(201).json({ success: true, task: await addAttachment(req.params.taskId, data, req.user.id) }); } catch (e) { next(e); }
};

// File upload for task attachments
const tasksDir = path.resolve('uploads/tasks');
if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });
const taskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tasksDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});
export const taskUpload = multer({ storage: taskStorage });

export const taskAttachmentUpload = async (req, res, next) => {
  try {
    if(!req.file){ const e=new Error('No file uploaded'); e.status=400; throw e; }
    const file = req.file;
    const payload = { url: `/uploads/tasks/${file.filename}`, name: file.originalname, size: file.size, type: file.mimetype };
    const task = await addAttachment(req.params.taskId, payload, req.user.id);
    res.status(201).json({ success:true, task, attachment: payload });
  } catch(e){ next(e); }
};

export const taskCommentPatch = async (req, res, next) => {
  try { const { text } = req.body; if(!text){ const e=new Error('Text required'); e.status=400; throw e; } res.json({ success:true, task: await editComment(req.params.taskId, req.params.commentId, text, req.user.id) }); } catch(e){ next(e); }
};

export const taskCommentDelete = async (req, res, next) => {
  try { res.json({ success:true, task: await deleteComment(req.params.taskId, req.params.commentId, req.user.id) }); } catch(e){ next(e); }
};

export const projectPatch = async (req, res, next) => {
  try {
    const data = validate(updateProjectSchema, req.body);
    const update = await (await import('../models/Project.js')).Project.findByIdAndUpdate(req.params.projectId, data, { new: true });
    if (!update) { const err = new Error('Project not found'); err.status = 404; throw err; }
    res.json({ success: true, project: update });
  } catch (e) { next(e); }
};

export const projectDelete = async (req, res, next) => {
  try {
    const Project = (await import('../models/Project.js')).Project;
    const existing = await Project.findById(req.params.projectId);
    if(!existing){ const err=new Error('Project not found'); err.status=404; throw err; }
    await existing.deleteOne();
    res.json({ success:true, deleted:true });
  } catch(e){ next(e); }
};

export const tasksGet = async (req, res, next) => {
  try { res.json({ success: true, tasks: await listTasks(req.params.projectId, req.query) }); } catch (e) { next(e); }
};

export const tasksPost = async (req, res, next) => {
  try { const data = validate(createTaskSchema, { ...req.body, project: req.params.projectId }); res.status(201).json({ success: true, task: await addTask(data) }); } catch (e) { next(e); }
};

export const taskPatch = async (req, res, next) => {
  try {
    const data = validate(updateTaskSchema, req.body);
    const task = await updateTask(req.params.taskId, data);
    if (data.status) {
      await createNotification({
        audienceRole: 'Project Manager',
        project: task.project,
        type: 'task',
        title: 'Task Status Updated',
        message: `${task.title} moved to ${task.status}`,
        link: `/pm/projects/${task.project}/tasks`,
        meta: { taskId: String(task._id), status: task.status },
      });
    }
    res.json({ success: true, task });
  } catch (e) { next(e); }
};

export const taskDetailGet = async (req, res, next) => {
  try { res.json({ success: true, task: await getTaskDetail(req.params.taskId) }); } catch (e) { next(e); }
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
