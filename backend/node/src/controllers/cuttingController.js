// src/controllers/cuttingController.js
// Endpoint eksekusi Engine Optimasi Pemotongan 2D (admin only).
const {
  optimizeOrder,
  simulateCustomCutting,
} = require('../services/cuttingOptimizationService');
const db = require('../config/db');

const GRAIN_ORIENTATIONS = ['lengthwise', 'widthwise', 'any'];

async function optimizeCutting(req, res) {
  const orderId = Number.parseInt(req.body.order_id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({
      success: false,
      message: 'order_id tidak valid.',
    });
  }

  try {
    // Biarkan operator_id NULL agar semua operator di lantai produksi dapat melihat & mengambil job.
    const result = await optimizeOrder(db, orderId, null);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error('Cutting optimization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Optimasi pemotongan tidak dapat diproses saat ini.',
    });
  }
}

function validateSimulationPayload(payload) {
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    return 'Minimal 1 tipe laci harus diisi.';
  }

  for (const [index, item] of items.entries()) {
    const label = `Item #${index + 1}`;
    const name = String(item.drawer_name ?? '').trim();
    const length = Number(item.length_mm);
    const width = Number(item.width_mm);
    const height = Number(item.height_mm);
    const quantity = Number(item.quantity);

    if (name === '') return `${label}: nama/kode laci wajib diisi.`;
    if (!Number.isFinite(length) || length <= 0)
      return `${label} (${name}): panjang harus berupa angka > 0.`;
    if (!Number.isFinite(width) || width <= 0)
      return `${label} (${name}): lebar harus berupa angka > 0.`;
    if (!Number.isFinite(height) || height <= 0)
      return `${label} (${name}): tinggi harus berupa angka > 0.`;
    if (!Number.isInteger(quantity) || quantity < 1)
      return `${label} (${name}): kuantitas harus bilangan bulat >= 1.`;

    const grain = item.grain_orientation ?? 'lengthwise';
    if (!GRAIN_ORIENTATIONS.includes(grain)) {
      return `${label} (${name}): arah serat harus lengthwise, widthwise, atau any.`;
    }
  }

  const sheetLength = Number(payload.sheet_length_mm);
  const sheetWidth = Number(payload.sheet_width_mm);
  if (
    (payload.sheet_length_mm !== undefined && (!Number.isFinite(sheetLength) || sheetLength <= 0)) ||
    (payload.sheet_width_mm !== undefined && (!Number.isFinite(sheetWidth) || sheetWidth <= 0))
  ) {
    return 'Ukuran lembaran harus berupa angka > 0.';
  }

  return null;
}

async function simulateCutting(req, res) {
  const validationError = validateSimulationPayload(req.body);
  if (validationError) {
    return res.status(422).json({ success: false, message: validationError });
  }

  try {
    const result = simulateCustomCutting(req.body);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    console.error('Cutting simulation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Simulasi pemotongan tidak dapat diproses saat ini.',
    });
  }
}

module.exports = { optimizeCutting, simulateCutting };
