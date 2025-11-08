import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { personalInfoSchema, changePasswordSchema, preferencesSchema } from '../validators/profile.validators.js';
import { getProfile, updatePersonalInfo, changePassword, updatePreferences } from '../services/profile.service.js';

const uploadDir = path.resolve('uploads/profile');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
export const avatarUpload = multer({ storage });

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) { const e = new Error(error.details.map(d => d.message).join(', ')); e.status = 400; throw e; }
  return value;
};

export const profileGet = async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    res.json({ success: true, profile });
  } catch (e) { next(e); }
};

export const profileUpdate = async (req, res, next) => {
  try {
    const payload = validate(personalInfoSchema, req.body);
    const avatarUrl = req.file ? `/uploads/profile/${req.file.filename}` : undefined;
    const profile = await updatePersonalInfo(req.user.id, payload, avatarUrl);
    res.json({ success: true, profile });
  } catch (e) { next(e); }
};

export const passwordChange = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
    const profile = await changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true, profile });
  } catch (e) { next(e); }
};

export const preferencesUpdate = async (req, res, next) => {
  try {
    const prefs = validate(preferencesSchema, req.body);
    const profile = await updatePreferences(req.user.id, prefs);
    res.json({ success: true, profile });
  } catch (e) { next(e); }
};
