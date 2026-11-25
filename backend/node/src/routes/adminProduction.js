const express = require("express");

const ctrl = require("../controllers/adminProductionController");
const { authMiddleware } = require("../middleware/auth");
const requireStaff = require("../middleware/requireStaff");

const router = express.Router();

router.use(authMiddleware, requireStaff);
router.get("/", ctrl.listProductionJobs);

module.exports = router;
