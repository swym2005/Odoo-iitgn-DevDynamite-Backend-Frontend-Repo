import Joi from 'joi';

export const aiChatSchema = Joi.object({
  message: Joi.string().min(2).required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  project: Joi.string().hex().length(24).optional(),
  role: Joi.string().optional(),
}).required();

export const aiInsightSchema = Joi.object({
  type: Joi.string().valid('top_profitable','cost_overruns','team_utilization','project_summary').required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  project: Joi.string().hex().length(24).optional(),
  role: Joi.string().optional(),
}).required();

export const aiReportSchema = Joi.object({
  type: Joi.string().valid('overview','project').required(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  project: Joi.string().hex().length(24).when('type', { is: 'project', then: Joi.required(), otherwise: Joi.optional() }),
  role: Joi.string().optional(),
}).required();
