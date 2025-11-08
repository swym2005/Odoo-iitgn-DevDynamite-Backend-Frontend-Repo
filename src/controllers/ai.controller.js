import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { aiChatSchema, aiInsightSchema, aiReportSchema } from '../validators/ai.validators.js';
import { chatRespond, insight, generateReport } from '../services/ai.service.js';

const uploadDir = path.resolve('uploads/ai');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
export const aiUpload = multer({ storage });

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const chat = async (req, res, next) => {
  try {
    const data = validate(aiChatSchema, req.body);
    // attachments metadata (not used in stub AI yet)
    const attachments = (req.files || []).map(f => ({ name: f.originalname, url: `/uploads/ai/${f.filename}`, size: f.size }));
    const response = await chatRespond(req.user, data);
    res.json({ success: true, ...response, attachments });
  } catch (e) { next(e); }
};

export const getInsight = async (req, res, next) => {
  try {
    const data = validate(aiInsightSchema, req.query);
    const response = await insight(req.user, data);
    res.json({ success: true, ...response });
  } catch (e) { next(e); }
};

export const report = async (req, res, next) => {
  try {
    const data = validate(aiReportSchema, req.body);
    const response = await generateReport(req.user, data);
    res.json({ success: true, ...response });
  } catch (e) { next(e); }
};
