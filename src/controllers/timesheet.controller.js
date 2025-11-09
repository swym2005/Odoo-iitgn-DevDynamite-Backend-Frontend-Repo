import { timesheetLogSchema, timesheetQuerySchema } from '../validators/timesheet.validators.js';
import { listMyTimesheets, logMyTimesheet, deleteMyTimesheet, summarizeMyTimesheets, chartsMyTimesheets, overviewMyTimesheets } from '../services/timesheet.service.js';

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const myTimesheetsGet = async (req, res, next) => {
  try {
    const filters = validate(timesheetQuerySchema, req.query);
    const items = await listMyTimesheets(req.user.id, filters || {});
    res.json({ success: true, items });
  } catch (e) { next(e); }
};

export const myTimesheetsPost = async (req, res, next) => {
  try {
    const data = validate(timesheetLogSchema, req.body);
    const ts = await logMyTimesheet(req.user.id, data);
    res.status(201).json({ success: true, timesheet: ts });
  } catch (e) { next(e); }
};

export const myTimesheetDelete = async (req, res, next) => {
  try {
    const result = await deleteMyTimesheet(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export const myTimesheetsSummary = async (req, res, next) => {
  try {
    const filters = validate(timesheetQuerySchema, req.query);
    const summary = await summarizeMyTimesheets(req.user.id, filters || {});
    res.json({ success: true, summary });
  } catch (e) { next(e); }
};

export const myTimesheetsCharts = async (req, res, next) => {
  try {
    const filters = validate(timesheetQuerySchema, req.query);
    const charts = await chartsMyTimesheets(req.user.id, filters || {});
    res.json({ success: true, charts });
  } catch (e) { next(e); }
};

export const myTimesheetsOverview = async (req, res, next) => {
  try {
    const overview = await overviewMyTimesheets(req.user.id);
    res.json({ success: true, ...overview });
  } catch (e) { next(e); }
};
