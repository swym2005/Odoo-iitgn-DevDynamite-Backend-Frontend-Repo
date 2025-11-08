import Joi from 'joi';

export const createProjectSchema = Joi.object({
  name: Joi.string().min(2).required(),
  description: Joi.string().allow('', null),
  client: Joi.string().allow('', null),
  budget: Joi.number().min(0).default(0),
  deadline: Joi.date().optional(),
  manager: Joi.string().hex().length(24).required(),
  teamMembers: Joi.array().items(Joi.string().hex().length(24)).default([]),
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().min(2),
  description: Joi.string().allow('', null),
  client: Joi.string().allow('', null),
  budget: Joi.number().min(0),
  deadline: Joi.date(),
  status: Joi.string().valid('planning','active','on-hold','completed','cancelled'),
  progress: Joi.number().min(0).max(100),
  revenue: Joi.number().min(0),
  cost: Joi.number().min(0),
  teamMembers: Joi.array().items(Joi.string().hex().length(24)),
}).min(1);

export const createTaskSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  title: Joi.string().min(2).required(),
  description: Joi.string().allow('', null),
  assignee: Joi.string().hex().length(24).allow(null, ''),
  priority: Joi.string().valid('low','medium','high','critical').default('medium'),
  status: Joi.string().valid('todo','in-progress','review','done','blocked').default('todo'),
  dueDate: Joi.date().optional(),
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(2),
  description: Joi.string().allow('', null),
  assignee: Joi.string().hex().length(24).allow(null, ''),
  priority: Joi.string().valid('low','medium','high','critical'),
  status: Joi.string().valid('todo','in-progress','review','done','blocked'),
  dueDate: Joi.date(),
  completedAt: Joi.date(),
}).min(1);

export const logTimesheetSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  task: Joi.string().hex().length(24).allow(null,''),
  hours: Joi.number().positive().max(24).required(),
  billable: Joi.boolean().default(true),
  note: Joi.string().allow('', null),
  date: Joi.date().optional(),
});

export const expenseCreateSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  description: Joi.string().min(2).required(),
  amount: Joi.number().positive().required(),
  billable: Joi.boolean().default(true),
});

export const expenseStatusSchema = Joi.object({
  status: Joi.string().valid('pending','approved','rejected').required(),
});

export const linkDocSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  type: Joi.string().valid('SO','PO','CustomerInvoice','VendorBill','Expense').required(),
  refId: Joi.string().required(),
  meta: Joi.object().default({}),
});
