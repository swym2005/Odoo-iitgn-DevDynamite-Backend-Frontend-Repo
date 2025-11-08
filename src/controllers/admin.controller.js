import { createUserSchema, updateUserSchema, createProjectSchema, updateSettingsSchema } from '../validators/admin.validators.js';
import { getDashboardKPIs, listUsers, createUser, updateUser, listProjects, createProject, getAnalytics, getSettings, updateSettings } from '../services/admin.service.js';

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) {
    const e = new Error(error.details.map(d => d.message).join(', '));
    e.status = 400;
    throw e;
  }
  return value;
};

export const dashboard = async (req, res, next) => {
  try {
    const kpis = await getDashboardKPIs();
    res.json({ success: true, kpis });
  } catch (err) { next(err); }
};

export const usersGet = async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ success: true, users });
  } catch (err) { next(err); }
};

export const usersPost = async (req, res, next) => {
  try {
    const data = validate(createUserSchema, req.body);
    const user = await createUser(data);
    res.status(201).json({ success: true, user });
  } catch (err) { next(err); }
};

export const userPatch = async (req, res, next) => {
  try {
    const data = validate(updateUserSchema, req.body);
    const updated = await updateUser(req.params.userId, data);
    res.json({ success: true, user: updated });
  } catch (err) { next(err); }
};

export const projectsGet = async (req, res, next) => {
  try {
    const projects = await listProjects();
    res.json({ success: true, projects });
  } catch (err) { next(err); }
};

export const projectsPost = async (req, res, next) => {
  try {
    const data = validate(createProjectSchema, req.body);
    const project = await createProject(data);
    res.status(201).json({ success: true, project });
  } catch (err) { next(err); }
};

export const analyticsGet = async (req, res, next) => {
  try {
    const analytics = await getAnalytics();
    res.json({ success: true, analytics });
  } catch (err) { next(err); }
};

export const settingsGet = async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};

export const settingsPut = async (req, res, next) => {
  try {
    const data = validate(updateSettingsSchema, req.body);
    const settings = await updateSettings(data);
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};
