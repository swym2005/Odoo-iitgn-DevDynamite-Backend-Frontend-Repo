import Joi from 'joi';

export const timesheetLogSchema = Joi.object({
  project: Joi.string().hex().length(24).required(),
  task: Joi.string().hex().length(24).allow('', null),
  hours: Joi.number().positive().max(24).required(),
  billable: Joi.boolean().default(true),
  note: Joi.string().allow('', null),
  date: Joi.date().optional(),
});

export const timesheetQuerySchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  project: Joi.string().hex().length(24).optional(),
  task: Joi.string().hex().length(24).optional(),
}).optional();
