import request from 'supertest';
import app from '../app.js';
import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';

const signupPayload = {
  name: 'Alice Tester',
  email: 'alice@example.com',
  password: 'Password123',
  role: 'Admin'
};

describe('Auth Flow', () => {
  test('Signup returns token and redirect path', async () => {
    const res = await request(app).post('/auth/signup').send(signupPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(signupPayload.email.toLowerCase());
    expect(res.body.redirectPath).toBe('/admin/dashboard');
    expect(res.body.token).toBeDefined();
    const decoded = jwt.decode(res.body.token);
    expect(decoded.role).toBe('Admin');
  });

  test('Login with rememberMe extends expiry (>= 29d)', async () => {
    // ensure user
    await request(app).post('/auth/signup').send({ ...signupPayload, email: 'bob@example.com', role: 'Team Member' });
    const res = await request(app).post('/auth/login').send({ email: 'bob@example.com', password: 'Password123', rememberMe: true });
    expect(res.status).toBe(200);
    const decoded = jwt.decode(res.body.token);
    const expMs = decoded.exp * 1000 - Date.now();
    const days = expMs / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThanOrEqual(29); // approximate
    expect(res.body.redirectPath).toBe('/team/dashboard');
  });

  test('Forgot password masks user existence', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'noone@nowhere.example' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
