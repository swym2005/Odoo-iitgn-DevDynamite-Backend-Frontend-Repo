import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { search } from '../controllers/search.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', search);

export default router;
