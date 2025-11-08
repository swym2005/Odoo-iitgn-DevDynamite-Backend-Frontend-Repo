import express from 'express';
import { requireAuth, requirePMOrAdmin } from '../middleware/auth.js';
import { getOverview, getProjectAnalytics, downloadOverviewCSV, downloadProjectCSV } from '../controllers/analytics.controller.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePMOrAdmin); // restrict analytics to PM/Admin roles

// Overview analytics with filters
router.get('/overview', getOverview);
// Single project analytics
router.get('/project/:projectId', getProjectAnalytics);
// Downloads
router.get('/overview/download', downloadOverviewCSV);
router.get('/project/:projectId/download', downloadProjectCSV);

export default router;
