import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { myTimesheetsGet, myTimesheetsPost, myTimesheetDelete, myTimesheetsSummary, myTimesheetsCharts, myTimesheetsOverview } from '../controllers/timesheet.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', myTimesheetsGet);
router.post('/', myTimesheetsPost);
router.delete('/:id', myTimesheetDelete);
router.get('/summary', myTimesheetsSummary);
router.get('/charts', myTimesheetsCharts);
router.get('/overview', myTimesheetsOverview);

export default router;
