const express = require("express");
const Joi = require("joi");

const ctrl = require("../controllers/adminInvoiceController");
const { authMiddleware } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validateBody = require("../middleware/validateBody");

const router = express.Router();

const createInvoiceSchema = Joi.object({
  order_id: Joi.number().integer().positive().required(),
  invoice_number: Joi.string().trim().min(1).max(50).required(),
  invoice_date: Joi.date().iso().required(),
  due_date: Joi.date().iso().greater(Joi.ref("invoice_date")).required(),
  total_amount: Joi.number().positive().precision(2).required(),
}).unknown(false);

const paymentSchema = Joi.object({
  amount_paid: Joi.number().positive().precision(2).required(),
  payment_date: Joi.date().iso().required(),
  payment_method: Joi.string()
    .valid("bank_transfer", "giro", "cash")
    .required(),
  notes: Joi.string().trim().max(65535).allow("").default(""),
}).unknown(false);

router.use(authMiddleware, requireAdmin);

router.get("/orders", ctrl.listAvailableOrders);
router.get("/", ctrl.listInvoices);
router.post(
  "/",
  validateBody(
    createInvoiceSchema,
    "Periksa kembali nomor invoice, PO, tanggal, dan total tagihan.",
  ),
  ctrl.createInvoice,
);
router.post(
  "/:id/payments",
  validateBody(
    paymentSchema,
    "Periksa kembali jumlah, tanggal, dan metode pembayaran.",
  ),
  ctrl.recordPayment,
);

module.exports = router;
