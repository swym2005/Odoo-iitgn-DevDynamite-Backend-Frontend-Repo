import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getNotifications, markRead, getUnreadCount } from '../controllers/notifications.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getNotifications);
router.post('/read', markRead);
router.get('/unread-count', getUnreadCount);

export default router;
