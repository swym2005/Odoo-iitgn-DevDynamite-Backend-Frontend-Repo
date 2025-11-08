import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMenu } from '../controllers/ui.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/menu', getMenu);

export default router;
