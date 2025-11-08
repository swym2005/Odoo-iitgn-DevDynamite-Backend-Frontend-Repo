import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { myTimesheetsGet, myTimesheetsPost, myTimesheetDelete, myTimesheetsSummary, myTimesheetsCharts } from '../controllers/timesheet.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', myTimesheetsGet);
router.post('/', myTimesheetsPost);
router.delete('/:id', myTimesheetDelete);
router.get('/summary', myTimesheetsSummary);
router.get('/charts', myTimesheetsCharts);

export default router;
