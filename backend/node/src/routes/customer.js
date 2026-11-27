// src/routes/customer.js
// Semua rute di bawah /api/customer — auth + RBAC customer di setiap endpoint
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const requireCustomer = require('../middleware/requireCustomer');
const { upload, drawingUpload, signatureUpload } = require('../middleware/upload');
const ctrl = require('../controllers/customerController');

// Helper agar error multer selalu mengembalikan JSON rapi (422)
function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(err.status || 422).json({
          success: false,
          message: err.message || 'File gagal diproses.',
        });
      }
      return next();
    });
  };
}

router.use(authMiddleware, requireCustomer);

// Dashboard & Master Material Konsinyasi
router.get('/dashboard', ctrl.getDashboard);
router.get('/materials', ctrl.getMaterials);

// PO MTO (dengan upload drawing opsional + penawaran harga awal)
router.post('/orders', handleUpload(drawingUpload.single('drawing_file')), ctrl.createOrder);
router.get('/orders', ctrl.getOrders);
router.get('/orders/:id', ctrl.getOrderDetail);

// Negosiasi Harga Dua Arah (Customer <-> Admin)
router.post('/orders/:id/negotiations/counter', ctrl.counterOrderOffer);
router.post('/orders/:id/negotiations/accept', ctrl.acceptOrderOffer);

// Kontrak Digital (mendukung upload gambar tanda tangan atau Base64 canvas)
router.get('/orders/:id/contract', ctrl.getContract);
router.post('/orders/:id/contract/sign', handleUpload(signatureUpload.single('signature_file')), ctrl.signContract);

// DP
router.post('/orders/:id/dp-payment', handleUpload(upload.single('payment_proof')), ctrl.submitDpPayment);

// Tracking & Penerimaan
router.get('/orders/:id/tracking', ctrl.getTracking);
router.patch('/deliveries/:id/confirm', ctrl.confirmDelivery);
router.post('/orders/:id/accept-final', ctrl.acceptFinalOrder);

// Invoice TOP 90
router.get('/invoices', ctrl.getInvoices);
router.post('/invoices/:id/payments', handleUpload(upload.single('payment_proof')), ctrl.payInvoice);

// RMA
router.get('/rma', ctrl.listRma);
router.post('/rma', handleUpload(upload.single('proof_media')), ctrl.createRma);

module.exports = router;