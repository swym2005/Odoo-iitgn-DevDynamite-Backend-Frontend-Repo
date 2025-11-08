import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { avatarUpload, profileGet, profileUpdate, passwordChange, preferencesUpdate } from '../controllers/profile.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', profileGet);
router.put('/', avatarUpload.single('avatar'), profileUpdate);
router.post('/change-password', passwordChange);
router.put('/preferences', preferencesUpdate);

export default router;
