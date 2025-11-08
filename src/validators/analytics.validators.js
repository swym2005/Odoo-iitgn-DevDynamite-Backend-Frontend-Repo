import Joi from 'joi';

export const overviewFiltersSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  project: Joi.string().hex().length(24).optional(),
  role: Joi.string().optional(),
}).optional();

export const projectFiltersSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
}).optional();
