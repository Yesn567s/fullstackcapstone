const db = require('../config/db');
const { sendVerificationEmailForUser } = require('../services/emailVerification');

async function sendEmailVerification(req, res) {
  return sendEmailVerificationForUserId(req.user.userId, res);
}

async function resendEmailVerification(req, res) {
  return sendEmailVerificationForUserId(req.body.userId, res);
}

async function sendEmailVerificationForUserId(userId, res) {
  try {
    const [users] = await db.execute(
      'SELECT email, email_verified FROM users WHERE id = ? AND role = ? LIMIT 1',
      [userId, 'customer'],
    );
    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Akun tidak ditemukan.',
      });
    }

    if (Number(user.email_verified) === 1) {
      return res.status(409).json({
        success: false,
        message: 'Alamat email sudah diverifikasi.',
      });
    }

    await sendVerificationEmailForUser(userId, user.email);
    return res.json({
      success: true,
      message: 'Email verifikasi telah dikirim.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email verifikasi belum dapat dikirim. Silakan coba lagi.',
    });
  }
}

async function getVerificationStatus(req, res) {
  const { userId } = req.query;
  if (typeof userId !== 'string' || !/^[1-9]\d*$/.test(userId)) {
    return res.status(422).json({
      success: false,
      message: 'ID akun tidak valid.',
    });
  }

  try {
    const [users] = await db.execute(
      'SELECT email_verified, phone_verified FROM users WHERE id = ? AND role = ? LIMIT 1',
      [userId, 'customer'],
    );
    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Akun tidak ditemukan.',
      });
    }

    return res.json({
      success: true,
      emailVerified: Number(user.email_verified) === 1,
      phoneVerified: Number(user.phone_verified) === 1,
    });
  } catch (error) {
    console.error('Verification status lookup error:', error.code || 'unknown');
    return res.status(500).json({
      success: false,
      message: 'Status verifikasi tidak dapat diperiksa saat ini.',
    });
  }
}

async function verifyEmailLink(req, res) {
  const { uid, t } = req.query;
  if (
    typeof uid !== 'string' ||
    !/^[1-9]\d*$/.test(uid) ||
    typeof t !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(t)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Tautan verifikasi tidak valid.',
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [tokens] = await connection.execute(
      'SELECT id FROM email_verification_tokens WHERE user_id = ? AND token = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1 FOR UPDATE',
      [uid, t],
    );

    if (!tokens.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Tautan verifikasi tidak valid, sudah digunakan, atau kedaluwarsa.',
      });
    }

    await connection.execute(
      'UPDATE users SET email_verified = 1 WHERE id = ?',
      [uid],
    );
    await connection.execute(
      'DELETE FROM email_verification_tokens WHERE id = ?',
      [tokens[0].id],
    );
    await connection.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message: 'Alamat email berhasil diverifikasi. Silakan masuk.',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Verification rollback error:', rollbackError);
      }
    }

    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verifikasi email tidak dapat diproses saat ini.',
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getVerificationStatus,
  resendEmailVerification,
  sendEmailVerification,
  verifyEmailLink,
};
