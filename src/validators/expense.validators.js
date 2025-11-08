import Joi from 'joi';

export const expenseCreateSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  description: Joi.string().min(2).required(),
  amount: Joi.number().positive().required(),
  billable: Joi.boolean().default(true),
}).required();

export const expenseStatusSchema = Joi.object({
  status: Joi.string().valid('pending','approved','rejected').required(),
}).required();

export const expenseReimburseSchema = Joi.object({
  reimbursed: Joi.boolean().valid(true).required(),
}).required();
