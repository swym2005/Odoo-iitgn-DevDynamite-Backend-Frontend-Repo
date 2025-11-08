import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { aiUpload, chat, getInsight, report } from '../controllers/ai.controller.js';

const router = express.Router();
router.use(requireAuth);

// Chat endpoint (supports attachments)
router.post('/chat', aiUpload.array('attachments', 5), chat);

// Insights (query params)
router.get('/insight', getInsight);

// Report generation (JSON body)
router.post('/report', report);

export default router;
