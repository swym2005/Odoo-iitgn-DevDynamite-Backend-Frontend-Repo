import { overviewFiltersSchema, projectFiltersSchema } from '../validators/analytics.validators.js';
import { overviewAnalytics, projectAnalytics, overviewReportCSV, projectReportCSV } from '../services/analytics.service.js';

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, allowUnknown: true });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const getOverview = async (req, res, next) => {
  try {
    const filters = validate(overviewFiltersSchema, req.query);
    const data = await overviewAnalytics(req.user, filters);
    res.json({ success: true, ...data });
  } catch (e) { next(e); }
};

export const getProjectAnalytics = async (req, res, next) => {
  try {
    const filters = validate(projectFiltersSchema, req.query);
    const data = await projectAnalytics(req.user, req.params.projectId, filters);
    res.json({ success: true, ...data });
  } catch (e) { next(e); }
};

export const downloadOverviewCSV = async (req, res, next) => {
  try {
    const filters = validate(overviewFiltersSchema, req.query);
    const csv = await overviewReportCSV(req.user, filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-overview.csv"');
    res.send(csv);
  } catch (e) { next(e); }
};

export const downloadProjectCSV = async (req, res, next) => {
  try {
    const filters = validate(projectFiltersSchema, req.query);
    const csv = await projectReportCSV(req.user, req.params.projectId, filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="project-analytics.csv"');
    res.send(csv);
  } catch (e) { next(e); }
};
