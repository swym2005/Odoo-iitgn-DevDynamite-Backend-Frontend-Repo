import jwt from 'jsonwebtoken';

export const signToken = (payload, rememberMe = false) => {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const expiresIn = rememberMe ? '30d' : '1d';
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  return jwt.verify(token, secret);
};
