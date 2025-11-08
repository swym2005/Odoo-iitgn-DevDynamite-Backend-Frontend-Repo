import express from 'express';
import { requireAuth, requireFinanceOrAdmin } from '../middleware/auth.js';
import { dashboard, salesOrdersGet, salesOrdersPost, salesOrdersConfirm, salesOrdersPaid, purchaseOrdersGet, purchaseOrdersPost, purchaseOrdersApprove, purchaseOrdersPaid, invoicesGet, invoicesPost, invoicesPaid, billsGet, billsPost, billsPaid, billUpload } from '../controllers/finance.controller.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireFinanceOrAdmin);

router.get('/dashboard', dashboard);

router.get('/sales-orders', salesOrdersGet);
router.post('/sales-orders', salesOrdersPost);
router.post('/sales-orders/:id/confirm', salesOrdersConfirm);
router.post('/sales-orders/:id/paid', salesOrdersPaid);
// Convert a Sales Order to Customer Invoice
router.post('/sales-orders/:id/convert-invoice', async (req, res, next) => {
	try {
		// Lazy import to avoid circular issues
		const { createInvoiceFromSalesOrder } = await import('../services/finance.service.js');
		const inv = await createInvoiceFromSalesOrder(req.params.id);
		res.status(201).json({ success: true, invoice: inv });
	} catch (e) { next(e); }
});

router.get('/purchase-orders', purchaseOrdersGet);
router.post('/purchase-orders', purchaseOrdersPost);
router.post('/purchase-orders/:id/approve', purchaseOrdersApprove);
router.post('/purchase-orders/:id/paid', purchaseOrdersPaid);

router.get('/invoices', invoicesGet);
router.post('/invoices', invoicesPost);
router.post('/invoices/:id/paid', invoicesPaid);

router.get('/vendor-bills', billsGet);
router.post('/vendor-bills', billUpload.single('attachment'), billsPost);
router.post('/vendor-bills/:id/paid', billsPaid);

export default router;
