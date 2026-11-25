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

module.exports = router;
