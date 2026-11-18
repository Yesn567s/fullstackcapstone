// src/routes/cutting.js
// Routes Engine Optimasi Pemotongan 2D (RBAC: admin).
const express = require('express');
const router = express.Router();

const { optimizeCutting, simulateCutting } = require('../controllers/cuttingController');
const { authMiddleware } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

// POST /api/cutting/optimize  body: { order_id } -> simpan ke cutting_jobs/patterns
router.post('/optimize', authMiddleware, requireAdmin, optimizeCutting);

// POST /api/cutting/simulate  body: { sheet_length_mm?, sheet_width_mm?, apply_dovetail?, include_bottom?, items: [...] }
// -> simulasi mandiri tanpa menyimpan ke database.
router.post('/simulate', authMiddleware, requireAdmin, simulateCutting);

module.exports = router;
