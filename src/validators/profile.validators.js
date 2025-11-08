import Joi from 'joi';

export const personalInfoSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().max(30).optional(),
  location: Joi.string().max(120).optional(),
}).required();

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required(),
}).required();

export const preferencesSchema = Joi.object({
  theme: Joi.string().valid('light','dark','system').optional(),
  notifications: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
  }).optional(),
}).required();
