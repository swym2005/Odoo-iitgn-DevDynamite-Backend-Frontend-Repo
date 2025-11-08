import Joi from 'joi';

const lineItem = Joi.object({
  description: Joi.string().allow('', null),
  product: Joi.string().allow('', null),
  quantity: Joi.number().min(0).default(1),
  unitPrice: Joi.number().min(0).default(0),
  taxRate: Joi.number().min(0).max(1).default(0),
  total: Joi.number().min(0).optional(),
  sourceExpense: Joi.string().hex().length(24).optional(),
});

export const salesOrderCreateSchema = Joi.object({
  customer: Joi.string().min(2).required(),
  project: Joi.string().hex().length(24).required(),
  amount: Joi.number().positive().optional(),
  lineItems: Joi.array().items(lineItem).default([]),
  description: Joi.string().allow('', null),
}).required();

export const purchaseOrderCreateSchema = Joi.object({
  vendor: Joi.string().min(2).required(),
  project: Joi.string().hex().length(24).required(),
  amount: Joi.number().positive().optional(),
  lineItems: Joi.array().items(lineItem).default([]),
  description: Joi.string().allow('', null),
}).required();

export const customerInvoiceCreateSchema = Joi.object({
  customer: Joi.string().min(2).required(),
  project: Joi.string().hex().length(24).required(),
  amount: Joi.number().positive().optional(),
  lineItems: Joi.array().items(lineItem).default([]),
  salesOrder: Joi.string().hex().length(24).allow('', null),
  date: Joi.date().optional(),
}).required();

export const vendorBillCreateSchema = Joi.object({
  vendor: Joi.string().min(2).required(),
  project: Joi.string().hex().length(24).required(),
  amount: Joi.number().positive().optional(),
  lineItems: Joi.array().items(lineItem).default([]),
  purchaseOrder: Joi.string().hex().length(24).allow('', null),
  date: Joi.date().optional(),
}).required();
