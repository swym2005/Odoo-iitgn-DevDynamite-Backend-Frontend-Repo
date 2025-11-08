import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';

const regex = (q) => ({ $regex: q, $options: 'i' });

export const globalSearch = async (user, { q, limit = 5 } = {}) => {
  if (!q || q.trim().length < 2) return { projects: [], tasks: [], invoices: [], salesOrders: [], purchaseOrders: [] };
  const lim = Math.min(20, Number(limit) || 5);

  // Projects: name, description
  const projects = await Project.find({ $or: [{ name: regex(q) }, { description: regex(q) }] })
    .select('name manager status')
    .limit(lim)
    .lean();

  // Tasks: title, description
  const tasks = await Task.find({ $or: [{ title: regex(q) }, { description: regex(q) }] })
    .populate('project', 'name')
    .select('title status project')
    .limit(lim)
    .lean();

  // Invoices: number, customer
  const invoices = await CustomerInvoice.find({ $or: [{ number: regex(q) }, { customer: regex(q) }] })
    .select('number customer status amount project')
    .limit(lim)
    .lean();

  // Sales Orders: number, customer
  const salesOrders = await SalesOrder.find({ $or: [{ number: regex(q) }, { customer: regex(q) }] })
    .select('number customer status amount project')
    .limit(lim)
    .lean();

  // Purchase Orders: number, vendor
  const purchaseOrders = await PurchaseOrder.find({ $or: [{ number: regex(q) }, { vendor: regex(q) }] })
    .select('number vendor status amount project')
    .limit(lim)
    .lean();

  return { projects, tasks, invoices, salesOrders, purchaseOrders };
};
