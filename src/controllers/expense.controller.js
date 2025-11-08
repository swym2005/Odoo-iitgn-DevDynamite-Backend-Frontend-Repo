import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { expenseCreateSchema, expenseReimburseSchema } from '../validators/expense.validators.js';
import { createExpense, listExpenses, setStatus, reimburse, dashboardKPIs, expensesByProject } from '../services/expense.service.js';

const uploadDir = path.resolve('uploads/receipts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});
export const receiptUpload = multer({ storage });

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const dashboard = async (req, res, next) => {
  try {
    const kpis = await dashboardKPIs(req.user);
    const chart = await expensesByProject(req.user);
    res.json({ success: true, kpis, chart });
  } catch (e) { next(e); }
};

export const expensesGet = async (req, res, next) => {
  try { res.json({ success: true, expenses: await listExpenses(req.user, req.query) }); } catch (e) { next(e); }
};

export const expensesPost = async (req, res, next) => {
  try {
    const data = validate(expenseCreateSchema, req.body);
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : undefined;
    const exp = await createExpense(req.user.id, data, receiptUrl);
    res.status(201).json({ success: true, expense: exp });
  } catch (e) { next(e); }
};

export const expenseApprove = async (req, res, next) => {
  try { res.json({ success: true, expense: await setStatus(req.params.id, 'approved') }); } catch (e) { next(e); }
};

export const expenseReject = async (req, res, next) => {
  try { res.json({ success: true, expense: await setStatus(req.params.id, 'rejected') }); } catch (e) { next(e); }
};

export const expenseReimburse = async (req, res, next) => {
  try {
    validate(expenseReimburseSchema, req.body);
    res.json({ success: true, expense: await reimburse(req.params.id) });
  } catch (e) { next(e); }
};
