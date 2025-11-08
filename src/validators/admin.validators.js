import Joi from 'joi';
import { Roles } from '../utils/roles.js';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid(Roles.Admin, Roles.ProjectManager, Roles.TeamMember, Roles.Finance, Roles.Vendor).required(),
});

export const updateUserSchema = Joi.object({
  role: Joi.string().valid(Roles.Admin, Roles.ProjectManager, Roles.TeamMember, Roles.Finance, Roles.Vendor),
  status: Joi.string().valid('active', 'inactive'),
}).min(1);

export const createProjectSchema = Joi.object({
  name: Joi.string().min(2).required(),
  manager: Joi.string().hex().length(24).required(),
  status: Joi.string().valid('planning', 'active', 'on-hold', 'completed', 'cancelled').default('planning'),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

export const updateSettingsSchema = Joi.object({
  companyName: Joi.string().allow(''),
  logoUrl: Joi.string().uri().allow(''),
  gstNumber: Joi.string().allow(''),
  address: Joi.string().allow(''),
  hourlyRates: Joi.array().items(Joi.object({ role: Joi.string().valid(Roles.Admin, Roles.ProjectManager, Roles.TeamMember, Roles.Finance, Roles.Vendor).required(), rate: Joi.number().min(0).required() })),
  currency: Joi.string().min(3).max(10),
  taxRate: Joi.number().min(0).max(100),
  theme: Joi.string().valid('light', 'dark'),
});
