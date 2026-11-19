// src/middleware/requireCustomer.js
// RBAC Customer: pastikan role customer + muat profil customers (isolasi IDOR)
// ---------------------------------------------------------------------------
const db = require('../config/db');

async function requireCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Fitur ini hanya untuk customer.',
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT c.id, c.company_name, c.loyalty_tier_id
       FROM customers c
       WHERE c.user_id = ?
       LIMIT 1`,
      [req.user.userId],
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        message: 'Profil customer tidak ditemukan untuk akun ini.',
      });
    }

    req.customer = rows[0];
    return next();
  } catch (error) {
    console.error('Customer authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Status customer tidak dapat diverifikasi saat ini.',
    });
  }
}

module.exports = requireCustomer;
