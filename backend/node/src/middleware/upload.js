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

const KTP_EXTENSIONS = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.jiff', 'image/gif'],
]);

const ktpUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      KTP_EXTENSIONS.get(extension) === file.mimetype ||
      (extension === '.jiff' && file.mimetype === 'application/octet-stream')
    ) {
      return cb(null, true);
    }
    const error = new Error('Gunakan gambar KTP berformat JPG, PNG, JIFF/GIF, atau JPEG.');
    error.status = 422;
    cb(error);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
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

module.exports = { ktpUpload, upload, UPLOAD_ROOT };
