import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { dashboard, usersGet, usersPost, userPatch, projectsGet, projectsPost, analyticsGet, settingsGet, settingsPut } from '../controllers/admin.controller.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/dashboard', dashboard);

router.get('/users', usersGet);
router.post('/users', usersPost);
router.patch('/users/:userId', userPatch);

router.get('/projects', projectsGet);
router.post('/projects', projectsPost);

router.get('/analytics', analyticsGet);

router.get('/settings', settingsGet);
router.put('/settings', settingsPut);

export default router;
