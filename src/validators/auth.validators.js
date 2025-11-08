import Joi from 'joi';
import { Roles } from '../utils/roles.js';

export const signupSchema = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string()
    .valid(Roles.Admin, Roles.ProjectManager, Roles.TeamMember, Roles.Finance, Roles.Vendor)
    .required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
});

export const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).max(128).required(),
});
