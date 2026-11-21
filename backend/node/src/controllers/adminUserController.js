const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { hashPassword } = require('../utils/passwords');

const KTP_UPLOAD_DIR = path.resolve(__dirname, '../../../../assets/images/ktp');

function isValidImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return false;
  const extension = path.extname(file.originalname).toLowerCase();
  const header = file.buffer.subarray(0, 8);

  if (extension === '.jpg' || extension === '.jpeg') {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (extension === '.png') {
    return header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === '.gif' || extension === '.jiff') {
    const signature = file.buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return false;
}

async function removeKtpImage(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('KTP image cleanup error:', error);
    }
  }
}

async function createUser(req, res) {
  const {
    username,
    password,
    fullName,
    email,
    phone,
    nik,
    gender,
    address,
    birthDate,
    role,
  } = req.body;
  if (!req.file || !isValidImage(req.file)) {
    return res.status(422).json({
      success: false,
      message: 'Masukan gambar KTP yang valid dengan format JPG, PNG, JIFF/GIF, atau JPEG.',
    });
  }

  let connection;
  let ktpFilePath;
  let transactionStarted = false;
  let committed = false;

  try {
    const passwordHash = await hashPassword(password);
    await fs.promises.mkdir(KTP_UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(req.file.originalname).toLowerCase()}`;
    ktpFilePath = path.join(KTP_UPLOAD_DIR, filename);
    await fs.promises.writeFile(ktpFilePath, req.file.buffer, { flag: 'wx' });

    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [result] = await connection.execute(
      'INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, passwordHash, fullName, email, phone, role],
    );
    await connection.execute(
      'INSERT INTO pegawai (user_id, nik, jenis_kelamin, alamat, tanggal_lahir, ktp_image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [
        result.insertId,
        nik,
        gender,
        address,
        birthDate,
        `assets/images/ktp/${filename}`,
      ],
    );
    await connection.commit();
    transactionStarted = false;
    committed = true;

    return res.status(201).json({
      success: true,
      message: 'Pengguna berhasil ditambahkan.',
      userId: result.insertId,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Create user rollback error:', rollbackError);
      }
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Username, email, atau NIK sudah digunakan.',
      });
    }

    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Pengguna tidak dapat ditambahkan saat ini.',
    });
  } finally {
    if (connection) connection.release();
    if (ktpFilePath && !committed) {
      await removeKtpImage(ktpFilePath);
    }
  }
}

module.exports = { createUser };
