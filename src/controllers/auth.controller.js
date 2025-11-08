import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validators.js';
import { signupService, loginService, createResetTokenService, verifyResetTokenService, resetPasswordService } from '../services/auth.service.js';

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload, { abortEarly: false });
  if (error) {
    const e = new Error(error.details.map(d => d.message).join(', '));
    e.status = 400;
    throw e;
  }
  return value;
};

export const signup = async (req, res, next) => {
  try {
    const data = validate(signupSchema, req.body);
    const result = await signupService(data);
    res.status(201).json({ success: true, animation: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = validate(loginSchema, req.body);
    const result = await loginService(data);
    res.json({ success: true, animation: 'success', ...result });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const data = validate(forgotPasswordSchema, req.body);
    await createResetTokenService({ email: data.email });
    res.json({ success: true, animation: 'email_sent' });
  } catch (err) {
    next(err);
  }
};

export const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await verifyResetTokenService(token);
    res.json({ success: true, animation: 'token_valid', ...result });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const data = validate(resetPasswordSchema, req.body);
    await resetPasswordService(token, data.password);
    res.json({ success: true, animation: 'password_reset' });
  } catch (err) {
    next(err);
  }
};
