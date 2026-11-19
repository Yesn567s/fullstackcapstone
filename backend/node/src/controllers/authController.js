const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const {
  clearAuthCookie,
  generateToken,
  setAuthCookie,
} = require('../middleware/auth');
const { sendVerificationEmailForUser } = require('../services/emailVerification');
const { validateNumber } = require('../lib/phoneValidator');

async function register(req, res) {
  const {
    fullname,
    username,
    email,
    phone,
    password,
    companyName,
    contactPerson,
    address,
  } = req.body;

  const phoneNumber = validateNumber(
    phone,
    process.env.PHONE_DEFAULT_REGION || 'ID',
  );
  if (!phoneNumber.valid) {
    return res.status(422).json({
      success: false,
      message: 'Masukkan nomor telepon yang valid.',
    });
  }
  const normalizedPhone = phoneNumber.e164;
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    const passwordHash = await hashPassword(password);
    await connection.beginTransaction();
    transactionStarted = true;

    const [userResult] = await connection.execute(
      'INSERT INTO users (username, password_hash, full_name, email, phone, role, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
      [username, passwordHash, fullname, email, normalizedPhone, 'customer'],
    );

    await connection.execute(
      'INSERT INTO customers (user_id, company_name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userResult.insertId,
        companyName,
        contactPerson,
        normalizedPhone,
        email,
        address || null,
      ],
    );

    await connection.commit();
    transactionStarted = false;
    connection.release();
    connection = null;

    let verificationEmailSent = true;
    try {
      await sendVerificationEmailForUser(userResult.insertId, email);
    } catch (error) {
      verificationEmailSent = false;
      console.error('Registration verification email error:', error);
    }

    return res.status(201).json({
      success: true,
      message:
        'Pendaftaran berhasil. Verifikasi alamat email dan periksa nomor telepon melalui NumVerify untuk mengaktifkan akun.',
      verificationEmailSent,
      userId: userResult.insertId,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Registration rollback error:', rollbackError);
      }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Username atau email sudah digunakan.',
      });
    }

    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Pendaftaran tidak dapat diproses saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

async function login(req, res) {
  const identifier = (req.body.username || req.body.identifier).trim();
  const { password, portal } = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    const [usernameRows] = await connection.execute(
      'SELECT id, username, password_hash, role, email, email_verified, phone_verified FROM users WHERE username = ? LIMIT 1',
      [identifier],
    );
    let user = usernameRows[0];

    if (!user) {
      const [emailRows] = await connection.execute(
        'SELECT id, username, password_hash, role, email, email_verified, phone_verified FROM users WHERE email = ? LIMIT 1',
        [identifier],
      );
      user = emailRows[0];
    }

    const allowedRoles =
      portal === 'staff' ? ['admin', 'operator'] : ['customer'];
    if (
      !user ||
      !(await verifyPassword(password, user.password_hash)) ||
      !allowedRoles.includes(user.role)
    ) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message:
          'Username/email atau password tidak benar, atau akun tidak memiliki akses ke portal ini.',
      });
    }

    let emailVerificationSent = false;
    const emailVerified =
      user.role !== 'customer' || Number(user.email_verified) === 1;
    const phoneVerified =
      user.role !== 'customer' || Number(user.phone_verified) === 1;

    if (user.role === 'customer' && !emailVerified) {
      connection.release();
      connection = null;
      try {
        await sendVerificationEmailForUser(user.id, user.email);
        emailVerificationSent = true;
      } catch (error) {
        console.error('Login verification email error:', error);
      }
    }

    if (user.role === 'customer' && (!emailVerified || !phoneVerified)) {
      clearAuthCookie(res);
      return res.status(403).json({
        success: false,
        verificationRequired: true,
        userId: user.id,
        emailVerificationSent,
        message: [
          !emailVerified && 'email',
          !phoneVerified && 'pemeriksaan nomor telepon via NumVerify',
        ]
          .filter(Boolean)
          .join(' dan ')
          .concat(' belum selesai.'),
      });
    }

    setAuthCookie(res, generateToken({ userId: user.id, role: user.role }));
    return res.json({
      success: true,
      user: { username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login tidak dapat diproses saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

async function logout(req, res) {
  clearAuthCookie(res);
  return res.json({ success: true });
}

async function profile(req, res) {
  let connection;

  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, email, role FROM users WHERE id = ? LIMIT 1',
      [req.user.userId],
    );
    const user = rows[0] || null;

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Sesi tidak valid. Silakan login kembali.',
      });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Profil tidak dapat dimuat saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { login, logout, profile, register };
