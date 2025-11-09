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
    // Project Manager Assignment Logic (per problem statement):
    // - When a Project Manager creates a project, they automatically become the manager
    // - Only Admins can assign a different Project Manager to a project
    // - If no manager is provided, default to current user (the creator)
    const incoming = { ...req.body };
    if (!incoming.manager) {
      // No manager specified - default to current user (the creator)
      incoming.manager = req.user.id;
    } else {
      // Manager was specified - only Admins can assign a different manager
      if (req.user.role !== 'Admin') {
        // Non-admin users cannot assign a different manager - they must be the manager themselves
        if (String(incoming.manager) !== String(req.user.id)) {
          const e = new Error('Only Admins can assign a different Project Manager. You will be assigned as the manager.');
          e.status = 403;
          throw e;
        }
      }
      // Validate that the assigned manager exists and is active
      // For Admin: allow assigning any active user as manager
      // For others: only Project Managers can be assigned
      const { User } = await import('../models/User.js');
      const managerUser = await User.findById(incoming.manager).select('role status').lean();
      if (!managerUser) {
        const e = new Error('Manager not found');
        e.status = 404;
        throw e;
      }
      if (managerUser.status !== 'active') {
        const e = new Error('Manager must be active');
        e.status = 400;
        throw e;
      }
      // Only non-Admin users are restricted to assigning Project Managers
      if (req.user.role !== 'Admin' && managerUser.role !== 'Project Manager') {
        const e = new Error('Only Project Managers can be assigned as manager');
        e.status = 400;
        throw e;
      }
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
    const incoming = { ...req.body };
    // If manager is being updated, only Admins can change it
    if (incoming.manager !== undefined) {
      // Only Admins can assign a different Project Manager
      if (req.user.role !== 'Admin') {
        // Non-admin users cannot change the manager
        const e = new Error('Only Admins can change the Project Manager');
        e.status = 403;
        throw e;
      }
              // Validate that the assigned manager exists and is active
              // For Admin: allow assigning any active user as manager
              // For others: only Project Managers can be assigned
              const { User } = await import('../models/User.js');
              const managerUser = await User.findById(incoming.manager).select('role status').lean();
              if (!managerUser) {
                const e = new Error('Manager not found');
                e.status = 404;
                throw e;
              }
              if (managerUser.status !== 'active') {
                const e = new Error('Manager must be active');
                e.status = 400;
                throw e;
              }
              // Only non-Admin users are restricted to assigning Project Managers
              if (req.user.role !== 'Admin' && managerUser.role !== 'Project Manager') {
                const e = new Error('Only Project Managers can be assigned as manager');
                e.status = 400;
                throw e;
              }
    }
    const data = validate(updateProjectSchema, incoming);
    // Convert teamMembers array to ObjectIds if provided
    if (data.teamMembers && Array.isArray(data.teamMembers)) {
      data.teamMembers = data.teamMembers.map(id => new mongoose.Types.ObjectId(id));
      // Ensure manager is also in teamMembers if manager is set
      if (data.manager) {
        const managerId = new mongoose.Types.ObjectId(data.manager);
        if (!data.teamMembers.find(tm => String(tm) === String(managerId))) {
          data.teamMembers.push(managerId);
        }
      } else {
        // If manager is not being updated, ensure existing manager is in teamMembers
        const { Project } = await import('../models/Project.js');
        const existing = await Project.findById(req.params.projectId).select('manager').lean();
        if (existing && existing.manager) {
          const managerId = new mongoose.Types.ObjectId(existing.manager);
          if (!data.teamMembers.find(tm => String(tm) === String(managerId))) {
            data.teamMembers.push(managerId);
          }
        }
      }
    }
    const update = await (await import('../models/Project.js')).Project.findByIdAndUpdate(req.params.projectId, data, { new: true }).populate('manager', 'name email').lean();
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
  try {
    const data = validate(createTaskSchema, { ...req.body, project: req.params.projectId });
    const task = await addTask(data);
    // Ensure assignee is a team member
    if (task.assignee) {
      const project = await (await import('../models/Project.js')).Project.findById(task.project);
      if (project && !project.teamMembers.some(m => String(m) === String(task.assignee))) {
        project.teamMembers.push(task.assignee);
        await project.save();
      }
    }
    res.status(201).json({ success: true, task });
  } catch (e) { next(e); }
};

export const taskPatch = async (req, res, next) => {
  try {
    const data = validate(updateTaskSchema, req.body);
    const task = await updateTask(req.params.taskId, data);
    // Ensure new assignee is a team member
    if (data.assignee) {
      const project = await (await import('../models/Project.js')).Project.findById(task.project);
      if (project && !project.teamMembers.some(m => String(m) === String(data.assignee))) {
        project.teamMembers.push(data.assignee);
        await project.save();
      }
    }
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
  try { 
    const { setStatus } = await import('../services/expense.service.js');
    const exp = await setStatus(req.params.expenseId, 'approved');
    // If billable, attach to (or create) draft invoice
    const { maybeAttachToInvoice } = await import('../services/expense.service.js');
    if (exp.billable) {
      try { await maybeAttachToInvoice(exp); } catch (attachErr) { console.error('Invoice attach failed', attachErr); }
    }
    res.json({ success: true, expense: exp }); 
  } catch (e) { next(e); }
};

export const expenseReject = async (req, res, next) => {
  try { 
    const { setStatus } = await import('../services/expense.service.js');
    const exp = await setStatus(req.params.expenseId, 'rejected');
    res.json({ success: true, expense: exp }); 
  } catch (e) { next(e); }
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
