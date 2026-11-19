// src/routes/customer.js
// Semua rute di bawah /api/customer — auth + RBAC customer di setiap endpoint
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const requireCustomer = require('../middleware/requireCustomer');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/customerController');

router.use(authMiddleware, requireCustomer);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);

// PO MTO
router.post('/orders', ctrl.createOrder);
router.get('/orders', ctrl.getOrders);
router.get('/orders/:id', ctrl.getOrderDetail);

// Kontrak digital
router.get('/orders/:id/contract', ctrl.getContract);
router.post('/orders/:id/contract/sign', ctrl.signContract);

// DP
router.post('/orders/:id/dp-payment', upload.single('payment_proof'), ctrl.submitDpPayment);

// Tracking & penerimaan
router.get('/orders/:id/tracking', ctrl.getTracking);
router.patch('/deliveries/:id/confirm', ctrl.confirmDelivery);

// Invoice TOP 90
router.get('/invoices', ctrl.getInvoices);
router.post('/invoices/:id/payments', upload.single('payment_proof'), ctrl.payInvoice);

// RMA
router.get('/rma', ctrl.listRma);
router.post('/rma', upload.single('proof_media'), ctrl.createRma);

module.exports = router;
