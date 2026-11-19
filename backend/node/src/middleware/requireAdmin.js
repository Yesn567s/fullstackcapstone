const db = require('../config/db');

async function requireAdmin(req, res, next) {
  if (req.user?.hardcodedAdmin && req.user.role === 'admin') {
    req.admin = { id: null, username: 'admin', role: 'admin' };
    return next();
  }

  let connection;

  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, role FROM users WHERE id = ? LIMIT 1',
      [req.user.userId],
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak valid. Silakan login kembali.',
      });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Hanya admin yang dapat menambahkan pengguna.',
      });
    }

    req.admin = user;
    return next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Status admin tidak dapat diverifikasi saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = requireAdmin;
