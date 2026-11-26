// src/middleware/upload.js
// Multer disk storage dengan validasi ekstensi & batas 10 MB
// ----------------------------------------------------------
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads');
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.mp4']);

// Pastikan direktori uploads tersedia saat server berjalan
['drawings', 'payments', 'rma', 'signatures'].forEach((sub) =>
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

const DRAWING_EXT = new Set(['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.webp']);
const SIGNATURE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const drawingUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, path.join(UPLOAD_ROOT, 'drawings'));
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `drawing-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    if (DRAWING_EXT.has(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    const err = new Error('Format drawing tidak didukung. Gunakan PDF, DWG, DXF, PNG, JPG, atau WEBP.');
    err.status = 422;
    return cb(err);
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

const signatureUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, path.join(UPLOAD_ROOT, 'signatures'));
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `sig-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    if (SIGNATURE_EXT.has(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    const err = new Error('Format tanda tangan tidak didukung. Gunakan PNG, JPG, JPEG, atau WEBP.');
    err.status = 422;
    return cb(err);
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

module.exports = { ktpUpload, upload, drawingUpload, signatureUpload, UPLOAD_ROOT };
