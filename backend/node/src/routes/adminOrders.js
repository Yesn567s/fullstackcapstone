const express = require("express");
const Joi = require("joi");

const ctrl = require("../controllers/adminOrderController");
const { authMiddleware } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validateBody = require("../middleware/validateBody");

const router = express.Router();

const createOrderSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  po_number: Joi.string().trim().max(50).allow("").default(""),
  order_date: Joi.date().iso().required(),
  top_days: Joi.number().integer().positive().max(3650).required(),
  drawer_type_code: Joi.string().trim().min(1).max(50).required(),
  length_mm: Joi.number().positive().max(999999.99).precision(2).required(),
  width_mm: Joi.number().positive().max(999999.99).precision(2).required(),
  height_mm: Joi.number().positive().max(999999.99).precision(2).required(),
  quantity: Joi.number().integer().positive().max(2147483647).required(),
}).unknown(false);

router.use(authMiddleware, requireAdmin);

router.get("/customers", ctrl.listCustomers);
router.get("/", ctrl.listOrders);
router.get("/:id", ctrl.getOrderDetail);
router.post(
  "/",
  validateBody(createOrderSchema, "Periksa kembali data PO dan spesifikasi pesanan."),
  ctrl.createOrder,
);

const counterOfferSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        order_item_id: Joi.number().integer().positive().required(),
        proposed_unit_price: Joi.number().positive().precision(2).required(),
      }).unknown(false),
    )
    .min(1)
    .required(),
  proposed_top_days: Joi.number().integer().min(0).max(365).optional(),
  proposed_dp_percent: Joi.number().min(0).max(100).precision(2).optional(),
  notes: Joi.string().trim().max(2000).allow("", null).default(""),
}).unknown(false);

const acceptOfferSchema = Joi.object({
  top_days: Joi.number().integer().min(0).max(365).optional(),
  required_dp_percent: Joi.number().min(0).max(100).precision(2).optional(),
  notes: Joi.string().trim().max(2000).allow("", null).default(""),
}).unknown(false);

const verifyDpSchema = Joi.object({
  action: Joi.string().valid("verify", "reject").required(),
  rejection_notes: Joi.string().trim().max(2000).allow("", null).default(""),
}).unknown(false);

router.post(
  "/:id/negotiations/counter",
  validateBody(counterOfferSchema, "Data counter-offer tidak valid."),
  ctrl.counterOffer,
);
router.post(
  "/:id/negotiations/accept",
  validateBody(acceptOfferSchema, "Data persetujuan penawaran tidak valid."),
  ctrl.acceptOffer,
);
router.patch(
  "/:id/verify-dp",
  validateBody(verifyDpSchema, "Aksi verifikasi DP tidak valid (gunakan verify atau reject)."),
  ctrl.verifyDpPayment,
);

module.exports = router;
