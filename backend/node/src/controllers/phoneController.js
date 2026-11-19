const db = require('../config/db');
const { lookupNumber } = require('../lib/numVerifyLookup');

async function findCustomer(userId) {
  const [rows] = await db.execute(
    'SELECT phone, phone_verified FROM users WHERE id = ? AND role = ? LIMIT 1',
    [userId, 'customer'],
  );
  return rows[0] || null;
}

function providerError(res, error) {
  if (error.code === 'NUMVERIFY_NOT_CONFIGURED') {
    return res.status(503).json({
      success: false,
      message: 'Verifikasi nomor telepon belum dikonfigurasi.',
    });
  }

  console.error('NumVerify lookup failed:', error.code || 'unknown');
  return res.status(502).json({
    success: false,
    message: 'Nomor telepon tidak dapat diperiksa saat ini.',
  });
}

async function verifyPhoneNumber(req, res) {
  let user;
  try {
    user = await findCustomer(req.body.userId);
  } catch (error) {
    console.error('Phone verification account lookup failed:', error.code || 'unknown');
    return res.status(500).json({
      success: false,
      message: 'Akun tidak dapat diperiksa saat ini.',
    });
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Akun tidak ditemukan.',
    });
  }
  if (Number(user.phone_verified) === 1) {
    return res.json({
      success: true,
      phoneVerified: true,
      message: 'Nomor telepon sudah diperiksa.',
    });
  }

  let result;
  try {
    result = await lookupNumber(user.phone);
  } catch (error) {
    return providerError(res, error);
  }

  if (!result.validFormat || !result.exists) {
    return res.status(422).json({
      success: false,
      message: 'NumVerify tidak mengenali nomor telepon ini sebagai nomor valid.',
    });
  }

  try {
    const [updateResult] = await db.execute(
      'UPDATE users SET phone_verified = 1 WHERE id = ? AND role = ? AND phone_verified = 0',
      [req.body.userId, 'customer'],
    );
    if (updateResult.affectedRows !== 1) {
      const currentUser = await findCustomer(req.body.userId);
      if (!currentUser || Number(currentUser.phone_verified) !== 1) {
        return res.status(404).json({
          success: false,
          message: 'Akun tidak ditemukan.',
        });
      }
    }

    return res.json({
      success: true,
      phoneVerified: true,
      message:
        'NumVerify memvalidasi nomor telepon. Pemeriksaan ini tidak membuktikan kepemilikan nomor.',
    });
  } catch (error) {
    console.error('Phone verification update failed:', error.code || 'unknown');
    return res.status(500).json({
      success: false,
      message: 'Status nomor telepon tidak dapat disimpan saat ini.',
    });
  }
}

module.exports = { verifyPhoneNumber };
