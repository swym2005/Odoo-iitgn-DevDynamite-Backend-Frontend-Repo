import express from 'express';
import { requireAuth, requireFinanceOrAdmin, requireFinancePMOrAdmin } from '../middleware/auth.js';
import { dashboard, salesOrdersGet, salesOrdersPost, salesOrdersConfirm, salesOrdersPaid, purchaseOrdersGet, purchaseOrdersPost, purchaseOrdersApprove, purchaseOrdersPaid, invoicesGet, invoicesPost, invoicesPaid, billsGet, billsPost, billsPaid, billUpload } from '../controllers/finance.controller.js';

const router = express.Router();

router.use(requireAuth);
// Dashboard and read operations require Finance or Admin
router.get('/dashboard', requireFinanceOrAdmin, dashboard);
router.get('/sales-orders', requireFinancePMOrAdmin, salesOrdersGet);
router.get('/purchase-orders', requireFinancePMOrAdmin, purchaseOrdersGet);
router.get('/invoices', requireFinancePMOrAdmin, invoicesGet);
router.get('/vendor-bills', requireFinancePMOrAdmin, billsGet);
// Write operations (create) allow PMs as well (for project settings)
router.post('/sales-orders', requireFinancePMOrAdmin, salesOrdersPost);
router.post('/purchase-orders', requireFinancePMOrAdmin, purchaseOrdersPost);
router.post('/invoices', requireFinancePMOrAdmin, invoicesPost);
router.post('/vendor-bills', requireFinancePMOrAdmin, billUpload.single('attachment'), billsPost);
// Status updates require Finance or Admin
router.post('/sales-orders/:id/confirm', requireFinanceOrAdmin, salesOrdersConfirm);
router.post('/sales-orders/:id/paid', requireFinanceOrAdmin, salesOrdersPaid);
router.post('/purchase-orders/:id/approve', requireFinanceOrAdmin, purchaseOrdersApprove);
router.post('/purchase-orders/:id/paid', requireFinanceOrAdmin, purchaseOrdersPaid);
router.post('/invoices/:id/paid', requireFinanceOrAdmin, invoicesPaid);
router.post('/vendor-bills/:id/paid', requireFinanceOrAdmin, billsPaid);

// Convert a Sales Order to Customer Invoice (allow PMs)
router.post('/sales-orders/:id/convert-invoice', requireFinancePMOrAdmin, async (req, res, next) => {
	try {
		// Lazy import to avoid circular issues
		const { createInvoiceFromSalesOrder } = await import('../services/finance.service.js');
		const inv = await createInvoiceFromSalesOrder(req.params.id);
		res.status(201).json({ success: true, invoice: inv });
	} catch (e) { next(e); }
});

export default router;
