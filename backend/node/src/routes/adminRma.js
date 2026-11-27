const express = require("express");
const Joi = require("joi");

const ctrl = require("../controllers/adminRmaController");
const { authMiddleware } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validateBody = require("../middleware/validateBody");

const router = express.Router();

const acknowledgeSchema = Joi.object({
  action: Joi.string().valid("acknowledge", "reject").required(),
  admin_notes: Joi.string().trim().max(500).allow("", null).default(""),
}).unknown(false);

router.use(authMiddleware, requireAdmin);

router.get("/", ctrl.listRmaRequests);
router.patch(
  "/:id/acknowledge",
  validateBody(acknowledgeSchema, "Aksi verifikasi RMA tidak valid."),
  ctrl.acknowledgeRma,
);
router.post("/:id/send-to-operator", ctrl.sendRmaToOperator);

module.exports = router;
