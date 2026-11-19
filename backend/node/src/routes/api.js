// src/routes/api.js
// Generic API routes (health, root)
// ------------------------------------------------
const express = require('express');
const router = express.Router();

// Health‑check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple root – tells client the API is alive
router.get('/', (req, res) => {
  res.json({ message: 'Node.js backend is running. Add routes under /api/*' });
});

// Customer API (RBAC buyer B2B, isolasi per customer_id)
router.use('/customer', require('./customer'));

module.exports = router;
