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
    // Handle FormData - multer processes the file, body contains text fields
    const payload = {};
    
    // Process name - must be at least 2 chars if provided
    if (req.body.name !== undefined) {
      const trimmed = String(req.body.name || '').trim();
      if (trimmed.length > 0) {
        if (trimmed.length < 2) {
          const e = new Error('Name must be at least 2 characters');
          e.status = 400;
          throw e;
        }
        payload.name = trimmed;
      }
    }
    
    // Process phone - can be empty
    if (req.body.phone !== undefined) {
      payload.phone = String(req.body.phone || '').trim();
    }
    
    // Process location - can be empty
    if (req.body.location !== undefined) {
      payload.location = String(req.body.location || '').trim();
    }
    
    // Check if we have any updates (including file upload)
    if (Object.keys(payload).length === 0 && !req.file) {
      const e = new Error('No updates provided');
      e.status = 400;
      throw e;
    }
    
    // Validate payload if it has fields
    if (Object.keys(payload).length > 0) {
      // Create validation object - only validate fields that are being updated
      const toValidate = {};
      if (payload.name !== undefined) toValidate.name = payload.name;
      if (payload.phone !== undefined) toValidate.phone = payload.phone;
      if (payload.location !== undefined) toValidate.location = payload.location;
      
      if (Object.keys(toValidate).length > 0) {
        validate(personalInfoSchema, toValidate);
      }
    }
    
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
