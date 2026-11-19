// src/middleware/upload.js
// Multer disk storage dengan validasi ekstensi & batas 10 MB
// ----------------------------------------------------------
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads');
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.mp4']);

// Pastikan direktori uploads tersedia saat server berjalan
['drawings', 'payments', 'rma'].forEach((sub) =>
  fs.mkdirSync(path.join(UPLOAD_ROOT, sub), { recursive: true }),
);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const sub = file.fieldname === 'technical_drawing' ? 'drawings' : file.fieldname === 'proof_media' ? 'rma' : 'payments';
    cb(null, path.join(UPLOAD_ROOT, sub));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase())) {
    return cb(null, true);
  }
  cb(new Error('Ekstensi file tidak diizinkan. Gunakan pdf/jpg/jpeg/png/webp/mp4.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { upload, UPLOAD_ROOT };
