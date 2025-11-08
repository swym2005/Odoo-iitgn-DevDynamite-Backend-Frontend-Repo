import express from 'express';
import { requireAuth, requirePMOrAdmin } from '../middleware/auth.js';
import { dashboard, expensesGet, expensesPost, expenseApprove, expenseReject, expenseReimburse, receiptUpload } from '../controllers/expense.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/dashboard', dashboard);
router.get('/', expensesGet);
router.post('/', receiptUpload.single('receipt'), expensesPost);

// Manager/Admin actions
router.post('/:id/approve', requirePMOrAdmin, expenseApprove);
router.post('/:id/reject', requirePMOrAdmin, expenseReject);
router.post('/:id/reimburse', requirePMOrAdmin, expenseReimburse);

export default router;
