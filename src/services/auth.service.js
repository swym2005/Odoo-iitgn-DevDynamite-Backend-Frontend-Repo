import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { signToken } from '../utils/jwt.js';
import { roleRedirect } from '../utils/roles.js';
import { generateResetToken } from '../utils/crypto.js';
import crypto from 'crypto';
import { sendEmail } from './email.service.js';

export const signupService = async ({ name, email, password, role }) => {
  const exists = await User.findOne({ email });
  if (exists) {
    const err = new Error('Email already registered');
    err.status = 400;
    throw err;
  }
  const user = await User.create({ name, email, password, role });
  const token = signToken({ sub: user._id, role: user.role }, false);
  const redirectPath = roleRedirect[user.role] || '/';
  return { user, token, redirectPath };
};

export const loginService = async ({ email, password, rememberMe = false }) => {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  const match = await user.matchPassword(password);
  if (!match) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  const token = signToken({ sub: user._id, role: user.role }, rememberMe);
  const redirectPath = roleRedirect[user.role] || '/';
  return { user, token, redirectPath };
};

export const createResetTokenService = async ({ email, appBaseUrl }) => {
  const user = await User.findOne({ email });
  if (!user) {
    // Do not reveal user existence
    return { status: 'ok' };
  }
  const { token, tokenHash } = generateResetToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt: expires });

  const resetLink = `${appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000'}/reset/${token}`;
  await sendEmail({
    to: user.email,
    subject: 'OrbitOne Password Reset',
    html: `<p>Hello ${user.name || ''},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p>`
  });
  return { status: 'ok' };
};

export const verifyResetTokenService = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rec = await PasswordResetToken.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } });
  if (!rec) {
    const err = new Error('Invalid or expired token');
    err.status = 400;
    throw err;
  }
  return { valid: true };
};

export const resetPasswordService = async (token, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rec = await PasswordResetToken.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } });
  if (!rec) {
    const err = new Error('Invalid or expired token');
    err.status = 400;
    throw err;
  }
  const user = await User.findById(rec.user);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  user.password = newPassword;
  await user.save();
  rec.used = true;
  await rec.save();
  return { status: 'ok' };
};
