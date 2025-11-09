import { User } from '../models/User.js';

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-password').lean();
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  return user;
};

export const updatePersonalInfo = async (userId, updates, avatarUrl) => {
  // Remove undefined values to avoid overwriting with undefined
  const payload = {};
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      payload[key] = updates[key];
    }
  });
  if (avatarUrl) payload.avatarUrl = avatarUrl;
  
  // Use $set to only update provided fields
  const updateObj = { $set: payload };
  const user = await User.findByIdAndUpdate(userId, updateObj, { new: true, runValidators: true }).select('-password').lean();
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  return user;
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  const ok = await user.matchPassword(currentPassword);
  if (!ok) { const e = new Error('Current password is incorrect'); e.status = 400; throw e; }
  user.password = newPassword;
  await user.save();
  const sanitized = user.toJSON();
  return sanitized;
};

export const updatePreferences = async (userId, prefs) => {
  const user = await User.findByIdAndUpdate(userId, { $set: { preferences: { ...prefs } } }, { new: true }).select('-password').lean();
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  return user;
};
