// src/middleware/requireStaff.js
// RBAC Staff: izinkan role admin ATAU operator (dashboard produksi, surat jalan).
const db = require('../config/db');

async function requireStaff(req, res, next) {
  if (req.user?.hardcodedAdmin && req.user.role === 'admin') {
    req.staff = { id: null, username: 'admin', role: 'admin' };
    return next();
  }

  if (!req.user || !['admin', 'operator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Fitur ini hanya untuk staff.',
    });
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, username, role FROM users WHERE id = ? LIMIT 1',
      [req.user.userId],
    );

    if (!rows.length || !['admin', 'operator'].includes(rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Sesi tidak valid untuk portal staff.',
      });
    }

    req.staff = rows[0];
    return next();
  } catch (error) {
    console.error('Staff authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Status staff tidak dapat diverifikasi saat ini.',
    });
  }
}

module.exports = requireStaff;
