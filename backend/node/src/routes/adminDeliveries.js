const express = require("express");
const Joi = require("joi");

const ctrl = require("../controllers/adminDeliveryController");
const { authMiddleware } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const requireStaff = require("../middleware/requireStaff");
const validateBody = require("../middleware/validateBody");

const router = express.Router();

const createDeliverySchema = Joi.object({
  order_id: Joi.number().integer().positive().required(),
  delivery_note_number: Joi.string().trim().min(1).max(50).required(),
  delivery_date: Joi.date().iso().required(),
  truck_plate_number: Joi.string().trim().min(1).max(20).required(),
  driver_name: Joi.string().trim().max(100).allow("", null).default(null),
  items: Joi.array()
    .items(
      Joi.object({
        order_item_id: Joi.number().integer().positive().required(),
        quantity_shipped: Joi.number().integer().positive().required(),
      }).unknown(false),
    )
    .min(1)
    .max(100)
    .unique("order_item_id")
    .required(),
  rma_replacement: Joi.boolean().default(false),
}).unknown(false);

// Read + create: staff (admin/operator). Lainnya tetap admin-only.
router.use(authMiddleware);

router.get("/", requireStaff, ctrl.listDeliveries);
router.get("/orders", requireAdmin, ctrl.listShippableOrders);
router.get("/orders/:orderId", requireAdmin, ctrl.getOrderForDelivery);
router.get("/:id", requireStaff, ctrl.getDeliveryDetails);
router.post(
  "/",
  requireAdmin,
  validateBody(createDeliverySchema, "Data surat jalan tidak valid."),
  ctrl.createDelivery,
);

module.exports = router;
