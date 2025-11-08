import express from 'express';
import { signup, login, forgotPassword, verifyResetToken, resetPassword } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/reset/:token', verifyResetToken);
router.post('/reset/:token', resetPassword);

export default router;
