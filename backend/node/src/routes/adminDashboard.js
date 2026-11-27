const express = require("express");

const ctrl = require("../controllers/adminDashboardController");
const { authMiddleware } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(authMiddleware, requireAdmin);
router.get("/", ctrl.getDashboard);

module.exports = router;
