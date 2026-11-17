const db = require('../config/db');
const { hashPassword } = require('../utils/passwords');

async function createUser(req, res) {
  const { username, password, fullName, email, phone, role } = req.body;
  let connection;

  try {
    const passwordHash = await hashPassword(password);
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, passwordHash, fullName, email, phone, role],
    );

    return res.status(201).json({
      success: true,
      message: 'Pengguna berhasil ditambahkan.',
      userId: result.insertId,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Username atau email sudah digunakan.',
      });
    }

    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Pengguna tidak dapat ditambahkan saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { createUser };
