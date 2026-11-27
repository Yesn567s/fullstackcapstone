// src/controllers/customerController.js
// Seluruh endpoint Role Customer (Buyer B2B) — isolasi ketat via req.customer.id
// -----------------------------------------------------------------------------
const crypto = require('crypto');
const db = require('../config/db');

const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('../middleware/upload');

// Helper: Muat seluruh riwayat negosiasi beserta rincian harga per item
async function loadOrderNegotiations(conn, orderId) {
  const [rounds] = await conn.execute(
    `SELECT n.*, u.full_name AS proposed_by_name
     FROM order_negotiations n
     LEFT JOIN users u ON u.id = n.proposed_by_user_id
     WHERE n.order_id = ?
     ORDER BY n.round_number ASC, n.id ASC`,
    [orderId],
  );
  if (!rounds.length) return [];

  const roundIds = rounds.map((r) => r.id);
  const placeholders = roundIds.map(() => '?').join(',');
  const [negItems] = await conn.execute(
    `SELECT ni.*, oi.drawer_type_code, oi.finished_length_mm, oi.finished_width_mm, oi.finished_height_mm
     FROM order_negotiation_items ni
     JOIN order_items oi ON oi.id = ni.order_item_id
     WHERE ni.negotiation_id IN (${placeholders})
     ORDER BY ni.id ASC`,
    roundIds,
  );

  const byNeg = new Map();
  for (const item of negItems) {
    if (!byNeg.has(item.negotiation_id)) byNeg.set(item.negotiation_id, []);
    byNeg.get(item.negotiation_id).push(item);
  }

  return rounds.map((r) => ({ ...r, items: byNeg.get(r.id) || [] }));
}

// Helper: Rakit teks kontrak lengkap yang sudah terisi data PO final
function buildContractSnapshot({ contract, order, customer, items, dpPercent }) {
  const dpAmount = (Number(order.total_order_value) * Number(dpPercent)) / 100;
  const itemLines = items
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.drawer_type_code} (${it.finished_length_mm}x${it.finished_width_mm}x${it.finished_height_mm} mm) — Qty: ${it.quantity} pcs @ Rp ${Number(it.unit_price).toLocaleString('id-ID')} = Rp ${(Number(it.quantity) * Number(it.unit_price)).toLocaleString('id-ID')}`,
    )
    .join('\n');

  return [
    contract.contract_title,
    `Versi Dokumen: ${contract.version}`,
    `Nomor Order / PO: ${order.order_number} / ${order.po_number}`,
    `Tanggal Order: ${String(order.order_date).slice(0, 10)}`,
    `Pihak Pembeli: ${customer.company_name} (PIC: ${customer.contact_person || '-'})`,
    `Alamat: ${customer.address || '-'}`,
    '',
    'RINCIAN PESANAN YANG DISEPAKATI:',
    itemLines,
    '',
    `Total Nilai Kontrak: Rp ${Number(order.total_order_value).toLocaleString('id-ID')}`,
    `Ketentuan Down Payment (DP): ${dpPercent}% (Rp ${dpAmount.toLocaleString('id-ID')})`,
    `Termin Pelunasan (TOP): ${order.top_days} Hari setelah Surat Jalan`,
    '',
    'SYARAT & KETENTUAN HUKUM:',
    contract.terms_and_conditions,
  ].join('\n');
}

// Helper: Simpan tanda tangan Base64 PNG/JPEG dari <canvas> ke uploads/signatures/
function saveBase64Signature(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) return null;

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) return null;

  const filename = `sig-canvas-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  const fullPath = path.join(UPLOAD_ROOT, 'signatures', filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);

  return { url: `/uploads/signatures/${filename}`, buffer };
}

const ok = (res, data, message) => res.json({ success: true, message, data });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Ambil order milik customer login (anti-IDOR), null jika bukan miliknya
async function getOwnedOrder(orderId, customerId, conn = db) {
  const [rows] = await conn.execute(
    'SELECT * FROM orders WHERE id = ? AND customer_id = ? LIMIT 1',
    [orderId, customerId],
  );
  return rows[0] || null;
}

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `PO-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ---------------------------------------------------------------------------
// 1. Dashboard & Ringkasan Akun
// ---------------------------------------------------------------------------
exports.getDashboard = async (req, res) => {
  try {
    const customerId = req.customer.id;

    const [[customer]] = await db.execute(
      `SELECT c.id, c.company_name, c.contact_person, c.phone, c.email, c.address,
              lt.tier_name, lt.discount_percentage, lt.priority_level
       FROM customers c
       LEFT JOIN loyalty_tiers lt ON lt.id = c.loyalty_tier_id
       WHERE c.id = ? LIMIT 1`,
      [customerId],
    );

    const [[credit]] = await db.execute(
      `SELECT credit_score, recommended_credit_limit, allow_top_90, required_dp_percent
       FROM customer_credit_scores WHERE customer_id = ? LIMIT 1`,
      [customerId],
    );

    const [orderStats] = await db.execute(
      `SELECT status, COUNT(*) AS total FROM orders WHERE customer_id = ? GROUP BY status`,
      [customerId],
    );

    const [consignment] = await db.execute(
      `SELECT COALESCE(SUM(remaining_quantity), 0) AS remaining_sheets
       FROM consignment_receipts WHERE customer_id = ?`,
      [customerId],
    );
    
    const [consignmentMaterials] = await db.execute(
      `SELECT m.id AS material_id, m.material_code, m.material_name,
              COALESCE(SUM(cr.received_quantity), 0) AS received_sheets,
              COALESCE(SUM(cr.remaining_quantity), 0) AS remaining_sheets,
              COALESCE(SUM(cr.received_quantity - cr.remaining_quantity), 0) AS used_sheets
       FROM consignment_receipts cr
       JOIN materials m ON m.id = cr.material_id
       WHERE cr.customer_id = ?
       GROUP BY m.id, m.material_code, m.material_name
       ORDER BY m.material_name ASC`,
      [customerId],
    );

    return ok(res, {
      customer,
      credit,
      order_stats: orderStats,
      consignment_remaining_sheets: Number(consignment[0].remaining_sheets),
      consignment_materials: consignmentMaterials,
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    return fail(res, 500, 'Dashboard customer tidak dapat dimuat saat ini.');
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.id, m.material_code, m.material_name, m.thickness_mm,
              m.default_length_mm, m.default_width_mm, m.customer_id,
              COALESCE((
                SELECT SUM(cr.remaining_quantity)
                FROM consignment_receipts cr
                WHERE cr.material_id = m.id AND cr.customer_id = ?
              ), m.stock_sheets, 0) AS available_sheets
       FROM materials m
       WHERE m.customer_id = ? OR m.customer_id IS NULL
       ORDER BY (m.customer_id = ?) DESC, m.material_name ASC`,
      [req.customer.id, req.customer.id, req.customer.id],
    );
    return ok(res, rows);
  } catch (error) {
    console.error('getMaterials error:', error);
    return fail(res, 500, 'Daftar material tidak dapat dimuat saat ini.');
  }
};

// ---------------------------------------------------------------------------
// 2. PO MTO — buat, daftar, detail
// ---------------------------------------------------------------------------
exports.createOrder = async (req, res) => {
  let items = req.body.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      return fail(res, 400, 'Format daftar item (items) tidak valid.');
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 400, 'Minimal satu item laci (P x L x T) harus diisi.');
  }

  let proposedTotal = 0;
  for (const it of items) {
    const lengthMm = Number(it.length_mm);
    const widthMm = Number(it.width_mm);
    const heightMm = Number(it.height_mm);
    const qty = Number(it.quantity);
    const unitPrice = Number(it.unit_price);

    if (![lengthMm, widthMm, heightMm, qty].every((v) => v > 0)) {
      return fail(res, 400, 'Setiap item butuh length_mm, width_mm, height_mm, dan quantity bernilai positif.');
    }
    if (!(unitPrice > 0)) {
      return fail(res, 400, 'Harga penawaran awal per unit (unit_price) wajib diisi lebih dari 0.');
    }
    proposedTotal += qty * unitPrice;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[credit]] = await conn.execute(
      'SELECT allow_top_90, required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1',
      [req.customer.id],
    );
    const defaultTopDays = credit && !credit.allow_top_90 ? 0 : 90;
    const defaultDpPercent = credit ? Number(credit.required_dp_percent) : 30;

    const orderNumber = generateOrderNumber();
    const orderDate = new Date().toISOString().slice(0, 10);
    const drawingFileUrl = req.file ? `/uploads/drawings/${req.file.filename}` : null;
    const notes = String(req.body.notes || '').trim() || null;

    const [orderResult] = await conn.execute(
      `INSERT INTO orders (
         order_number, customer_id, po_number, order_date, top_days,
         total_order_value, required_dp_percent, drawing_file_url,
         negotiation_round, notes, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'negotiating_admin_review')`,
      [
        orderNumber,
        req.customer.id,
        req.body.po_number || orderNumber,
        orderDate,
        defaultTopDays,
        proposedTotal,
        defaultDpPercent,
        drawingFileUrl,
        notes,
      ],
    );
    const orderId = orderResult.insertId;

    const insertedItems = [];
    for (const it of items) {
      const materialId = it.material_id ? Number(it.material_id) : null;
      const qty = Number(it.quantity);
      const unitPrice = Number(it.unit_price);

      const [itemRes] = await conn.execute(
        `INSERT INTO order_items
         (order_id, material_id, drawer_type_code, finished_length_mm, finished_width_mm, finished_height_mm, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          Number.isInteger(materialId) && materialId > 0 ? materialId : null,
          String(it.drawer_type_code || 'MTO').slice(0, 50),
          Number(it.length_mm),
          Number(it.width_mm),
          Number(it.height_mm),
          qty,
          unitPrice,
        ],
      );
      insertedItems.push({ order_item_id: itemRes.insertId, quantity: qty, unit_price: unitPrice });
    }

    // Simpan Ronde 1 Negosiasi (Penawaran Awal Customer)
    const [negRes] = await conn.execute(
      `INSERT INTO order_negotiations (
         order_id, round_number, proposed_by_role, proposed_by_user_id,
         action_type, proposed_total_value, proposed_top_days, proposed_dp_percent,
         notes, status
       ) VALUES (?, 1, 'customer', ?, 'initial_offer', ?, ?, ?, ?, 'open')`,
      [orderId, req.user.userId, proposedTotal, defaultTopDays, defaultDpPercent, notes],
    );
    const negotiationId = negRes.insertId;

    for (const it of insertedItems) {
      await conn.execute(
        `INSERT INTO order_negotiation_items (negotiation_id, order_item_id, proposed_unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [negotiationId, it.order_item_id, it.unit_price, it.quantity, it.quantity * it.unit_price],
      );
    }

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Offer_Submitted', ?, ?)`,
      [
        orderId,
        `Penawaran awal PO ${orderNumber} senilai Rp ${proposedTotal.toLocaleString('id-ID')} dikirim ke Admin untuk ditinjau.`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: 'Penawaran PO berhasil dikirim ke Admin untuk ditinjau.',
      data: {
        order_id: orderId,
        order_number: orderNumber,
        status: 'negotiating_admin_review',
        total_order_value: proposedTotal,
        drawing_file_url: drawingFileUrl,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('createOrder error:', error);
    return fail(res, 500, 'PO gagal disimpan.');
  } finally {
    conn.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, o.order_date, o.top_days,
              o.total_order_value, o.required_dp_percent, o.drawing_file_url,
              o.negotiation_round, o.agreed_at, o.notes, o.status,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_units,
              (SELECT oi.drawer_type_code FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id ASC LIMIT 1) AS primary_item,
              (SELECT COUNT(*) FROM contract_approvals ca WHERE ca.order_id = o.id) AS contract_signed,
              (SELECT COALESCE(SUM(dp.paid_amount), 0) FROM dp_payments dp WHERE dp.order_id = o.id) AS dp_paid,
              (SELECT dp.verification_status FROM dp_payments dp WHERE dp.order_id = o.id ORDER BY dp.id DESC LIMIT 1) AS dp_verification_status,
              (SELECT COUNT(*) FROM deliveries d WHERE d.order_id = o.id) AS shipment_count
       FROM orders o
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [req.customer.id],
    );
    return ok(res, rows);
  } catch (error) {
    console.error('getOrders error:', error);
    return fail(res, 500, 'Daftar PO gagal dimuat.');
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await getOwnedOrder(req.params.id, req.customer.id);
    if (!order) return fail(res, 404, 'PO tidak ditemukan.');

    const [items] = await db.execute(
      `SELECT oi.*, m.material_name
       FROM order_items oi
       LEFT JOIN materials m ON m.id = oi.material_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [order.id],
    );
    const negotiations = await loadOrderNegotiations(db, order.id);
    const [approvals] = await db.execute('SELECT * FROM contract_approvals WHERE order_id = ?', [order.id]);
    const [dps] = await db.execute('SELECT * FROM dp_payments WHERE order_id = ? ORDER BY id DESC', [order.id]);
    const [[credit]] = await db.execute(
      'SELECT credit_score, recommended_credit_limit, allow_top_90, required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1',
      [req.customer.id],
    );
    const [rawTracking] = await db.execute(
      'SELECT stage, affected_quantity, status_description, updated_at FROM po_tracking_logs WHERE order_id = ? ORDER BY updated_at ASC',
      [order.id],
    );
    const cuttingSummary = await getCuttingSummary(order.id);
    const tracking = buildCustomerTimeline(rawTracking, cuttingSummary, order.order_date);
    const [deliveries] = await db.execute(
      `SELECT d.*, (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = d.id) AS item_lines
       FROM deliveries d WHERE d.order_id = ?`,
      [order.id],
    );
    const [invoices] = await db.execute('SELECT * FROM invoices WHERE order_id = ?', [order.id]);

    return ok(res, {
      order,
      items,
      negotiations,
      credit: credit || null,
      contract: approvals[0] || null,
      dp_payments: dps,
      tracking,
      deliveries,
      invoices,
    });
  } catch (error) {
    console.error('getOrderDetail error:', error);
    return fail(res, 500, 'Detail PO gagal dimuat.');
  }
};

// Customer mengajukan Counter-Offer balik saat status = negotiating_customer_review
exports.counterOrderOffer = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOwnedOrder(req.params.id, req.customer.id, conn);
    if (!order) {
      await conn.rollback();
      return fail(res, 404, 'PO tidak ditemukan.');
    }
    if (order.status !== 'negotiating_customer_review') {
      await conn.rollback();
      return fail(res, 400, 'Counter-offer hanya dapat dikirim saat menunggu respons Customer.');
    }

    const [orderItems] = await conn.execute(
      'SELECT id, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC',
      [order.id],
    );
    const reqItems = Array.isArray(req.body.items) ? req.body.items : [];
    const priceByItemId = new Map();
    for (const ri of reqItems) {
      priceByItemId.set(Number(ri.order_item_id), Number(ri.proposed_unit_price));
    }

    // Fallback untuk single-item shorthand: { proposed_unit_price }
    if (priceByItemId.size === 0 && orderItems.length === 1 && Number(req.body.proposed_unit_price) > 0) {
      priceByItemId.set(orderItems[0].id, Number(req.body.proposed_unit_price));
    }

    let proposedTotal = 0;
    const roundItems = [];
    for (const oi of orderItems) {
      const price = priceByItemId.get(oi.id);
      if (!(price > 0)) {
        await conn.rollback();
        return fail(res, 400, `Harga counter-offer untuk item #${oi.id} harus lebih dari 0.`);
      }
      const subtotal = Number(oi.quantity) * price;
      proposedTotal += subtotal;
      roundItems.push({ order_item_id: oi.id, quantity: Number(oi.quantity), unit_price: price, subtotal });
    }

    await conn.execute(
      "UPDATE order_negotiations SET status = 'countered' WHERE order_id = ? AND status = 'open'",
      [order.id],
    );

    const nextRound = Number(order.negotiation_round || 1) + 1;
    const notes = String(req.body.notes || '').trim() || null;

    const [negRes] = await conn.execute(
      `INSERT INTO order_negotiations (
         order_id, round_number, proposed_by_role, proposed_by_user_id,
         action_type, proposed_total_value, proposed_top_days, proposed_dp_percent,
         notes, status
       ) VALUES (?, ?, 'customer', ?, 'counter_offer', ?, ?, ?, ?, 'open')`,
      [
        order.id,
        nextRound,
        req.user.userId,
        proposedTotal,
        order.top_days,
        order.required_dp_percent,
        notes,
      ],
    );

    for (const ri of roundItems) {
      await conn.execute(
        `INSERT INTO order_negotiation_items (negotiation_id, order_item_id, proposed_unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [negRes.insertId, ri.order_item_id, ri.unit_price, ri.quantity, ri.subtotal],
      );
    }

    await conn.execute(
      `UPDATE orders
       SET status = 'negotiating_admin_review', negotiation_round = ?, total_order_value = ?
       WHERE id = ?`,
      [nextRound, proposedTotal, order.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Counter_Offer', ?, ?)`,
      [
        order.id,
        `Customer mengajukan counter-offer ronde #${nextRound} senilai Rp ${proposedTotal.toLocaleString('id-ID')}.`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return ok(
      res,
      { order_id: order.id, round_number: nextRound, status: 'negotiating_admin_review', proposed_total_value: proposedTotal },
      'Counter-offer berhasil dikirim ke Admin.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('counterOrderOffer error:', error);
    return fail(res, 500, 'Counter-offer gagal dikirim.');
  } finally {
    conn.release();
  }
};

// Customer menyetujui Counter-Offer dari Admin -> status berubah ke quote_agreed
exports.acceptOrderOffer = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOwnedOrder(req.params.id, req.customer.id, conn);
    if (!order) {
      await conn.rollback();
      return fail(res, 404, 'PO tidak ditemukan.');
    }
    if (order.status !== 'negotiating_customer_review') {
      await conn.rollback();
      return fail(res, 400, 'Tidak ada penawaran Admin yang sedang menunggu persetujuan Anda.');
    }

    const [[openNeg]] = await conn.execute(
      `SELECT * FROM order_negotiations
       WHERE order_id = ? AND status = 'open' AND proposed_by_role = 'admin'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [order.id],
    );
    if (!openNeg) {
      await conn.rollback();
      return fail(res, 400, 'Data penawaran terbuka dari Admin tidak ditemukan.');
    }

    const [negItems] = await conn.execute(
      'SELECT * FROM order_negotiation_items WHERE negotiation_id = ?',
      [openNeg.id],
    );

    let agreedTotal = 0;
    for (const ni of negItems) {
      await conn.execute('UPDATE order_items SET unit_price = ? WHERE id = ? AND order_id = ?', [
        ni.proposed_unit_price,
        ni.order_item_id,
        order.id,
      ]);
      agreedTotal += Number(ni.proposed_unit_price) * Number(ni.quantity);
    }
    if (agreedTotal <= 0) agreedTotal = Number(openNeg.proposed_total_value);

    const agreedTopDays = openNeg.proposed_top_days !== null ? Number(openNeg.proposed_top_days) : Number(order.top_days || 90);
    const agreedDpPercent = openNeg.proposed_dp_percent !== null ? Number(openNeg.proposed_dp_percent) : Number(order.required_dp_percent || 30);

    await conn.execute("UPDATE order_negotiations SET status = 'accepted' WHERE id = ?", [openNeg.id]);

    const nextRound = Number(order.negotiation_round || 1) + 1;
    await conn.execute(
      `INSERT INTO order_negotiations (
         order_id, round_number, proposed_by_role, proposed_by_user_id,
         action_type, proposed_total_value, proposed_top_days, proposed_dp_percent,
         notes, status
       ) VALUES (?, ?, 'customer', ?, 'accept', ?, ?, ?, ?, 'accepted')`,
      [
        order.id,
        nextRound,
        req.user.userId,
        agreedTotal,
        agreedTopDays,
        agreedDpPercent,
        String(req.body.notes || 'Customer menyetujui penawaran harga Admin.').trim(),
      ],
    );

    await conn.execute(
      `UPDATE orders
       SET status = 'quote_agreed',
           total_order_value = ?,
           top_days = ?,
           required_dp_percent = ?,
           negotiation_round = ?,
           agreed_at = NOW(),
           agreed_by_role = 'customer'
       WHERE id = ?`,
      [agreedTotal, agreedTopDays, agreedDpPercent, nextRound, order.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Quote_Agreed', ?, ?)`,
      [
        order.id,
        `Harga final Rp ${agreedTotal.toLocaleString('id-ID')} disepakati oleh Customer. Kontrak digital siap ditandatangani.`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return ok(
      res,
      {
        order_id: order.id,
        status: 'quote_agreed',
        total_order_value: agreedTotal,
        top_days: agreedTopDays,
        required_dp_percent: agreedDpPercent,
      },
      'Penawaran disetujui! Silakan lanjut ke penandatanganan kontrak digital.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('acceptOrderOffer error:', error);
    return fail(res, 500, 'Persetujuan penawaran gagal diproses.');
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------------
// 3. Kontrak Digital & Legal Lock-in
// ---------------------------------------------------------------------------
exports.getContract = async (req, res) => {
  try {
    const order = await getOwnedOrder(req.params.id, req.customer.id);
    if (!order) return fail(res, 404, 'PO tidak ditemukan.');

    const [contracts] = await db.execute(
      'SELECT id, contract_title, terms_and_conditions, version FROM legal_contracts WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1',
    );
    if (!contracts.length) return fail(res, 404, 'Belum ada kontrak aktif.');

    const [[customer]] = await db.execute(
      'SELECT company_name, contact_person, address, phone, email FROM customers WHERE id = ? LIMIT 1',
      [req.customer.id],
    );
    const [items] = await db.execute('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [order.id]);
    const [[credit]] = await db.execute(
      'SELECT credit_score, allow_top_90, required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1',
      [req.customer.id],
    );
    const [[approval]] = await db.execute(
      'SELECT * FROM contract_approvals WHERE order_id = ? LIMIT 1',
      [order.id],
    );
    const [dpPayments] = await db.execute(
      'SELECT * FROM dp_payments WHERE order_id = ? ORDER BY id DESC',
      [order.id],
    );

    const dpPercent = order.required_dp_percent !== null
      ? Number(order.required_dp_percent)
      : credit ? Number(credit.required_dp_percent) : 30;
    const requiredDpAmount = (Number(order.total_order_value) * dpPercent) / 100;

    const unlockedStatuses = [
      'quote_agreed', 'contract_signed', 'dp_pending',
      'ready_for_production', 'in_production', 'partially_shipped', 'completed',
    ];
    const isNegotiationAgreed = unlockedStatuses.includes(order.status);
    const populatedContractText = approval?.contract_snapshot
      || buildContractSnapshot({ contract: contracts[0], order, customer, items, dpPercent });

    return ok(res, {
      contract: contracts[0],
      populated_contract_text: populatedContractText,
      approval: approval || null,
      order,
      items,
      dp_payments: dpPayments,
      required_dp_percent: dpPercent,
      required_dp_amount: requiredDpAmount,
      is_negotiation_agreed: isNegotiationAgreed,
      can_sign: order.status === 'quote_agreed' && !approval,
      locked_reason: isNegotiationAgreed
        ? null
        : 'Kontrak digital hanya terbuka setelah negosiasi harga disepakati oleh Customer dan Admin.',
    });
  } catch (error) {
    console.error('getContract error:', error);
    return fail(res, 500, 'Kontrak gagal dimuat.');
  }
};

exports.signContract = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOwnedOrder(req.params.id, req.customer.id, conn);
    if (!order) {
      await conn.rollback();
      return fail(res, 404, 'PO tidak ditemukan.');
    }
    if (order.status !== 'quote_agreed') {
      await conn.rollback();
      return fail(res, 400, 'Kontrak hanya dapat ditandatangani setelah harga penawaran disepakati (quote_agreed).');
    }
    if (!(Number(order.total_order_value) > 0)) {
      await conn.rollback();
      return fail(res, 400, 'Nilai kontrak belum ditetapkan.');
    }

    const agreed = req.body.agreed === true || req.body.agreed === 'true' || req.body.agreed === '1';
    const signerName = String(req.body.signer_name || '').trim();
    const signerTitle = String(req.body.signer_title || '').trim() || null;
    if (!agreed) {
      await conn.rollback();
      return fail(res, 400, 'Anda wajib mencentang persetujuan isi kontrak sebelum menandatangani.');
    }
    if (!signerName) {
      await conn.rollback();
      return fail(res, 400, 'Nama lengkap penandatangan wajib diisi.');
    }

    const [[existing]] = await conn.execute(
      'SELECT id FROM contract_approvals WHERE order_id = ? LIMIT 1',
      [order.id],
    );
    if (existing) {
      await conn.rollback();
      return fail(res, 409, 'Kontrak untuk PO ini sudah ditandatangani sebelumnya.');
    }

    // Proses tanda tangan digital (upload file gambar ATAU goresan Base64 dari <canvas>)
    let signatureImageUrl = null;
    let signatureBuffer = null;
    if (req.file) {
      signatureImageUrl = `/uploads/signatures/${req.file.filename}`;
      signatureBuffer = fs.readFileSync(req.file.path);
    } else if (req.body.signature_data_url) {
      const saved = saveBase64Signature(req.body.signature_data_url);
      if (!saved) {
        await conn.rollback();
        return fail(res, 400, 'Data gambar tanda tangan tidak valid atau melebihi batas 2 MB.');
      }
      signatureImageUrl = saved.url;
      signatureBuffer = saved.buffer;
    } else {
      await conn.rollback();
      return fail(res, 400, 'Tanda tangan digital wajib dibuat di layar atau diunggah sebagai file gambar.');
    }

    const [contracts] = await conn.execute(
      'SELECT id, contract_title, terms_and_conditions, version FROM legal_contracts WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1',
    );
    if (!contracts.length) {
      await conn.rollback();
      return fail(res, 404, 'Belum ada kontrak aktif untuk ditandatangani.');
    }
    const activeContract = contracts[0];

    const [[customer]] = await conn.execute(
      'SELECT company_name, contact_person, address FROM customers WHERE id = ? LIMIT 1',
      [req.customer.id],
    );
    const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [order.id]);
    const dpPercent = order.required_dp_percent !== null ? Number(order.required_dp_percent) : 30;
    const contractSnapshot = buildContractSnapshot({
      contract: activeContract,
      order,
      customer,
      items,
      dpPercent,
    });

    const timestamp = new Date().toISOString();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);
    const signatureFileHash = crypto.createHash('sha256').update(signatureBuffer).digest('hex');
    const hash = crypto
      .createHash('sha256')
      .update(
        `${order.id}|${activeContract.id}|${contractSnapshot}|${order.total_order_value}|${signatureFileHash}|${signerName}|${req.ip}|${timestamp}`,
      )
      .digest('hex');

    await conn.execute(
      `INSERT INTO contract_approvals (
         order_id, legal_contract_id, customer_id,
         signer_name, signer_title, signature_image_url, contract_snapshot,
         ip_address, user_agent, digital_signature_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        activeContract.id,
        req.customer.id,
        signerName,
        signerTitle,
        signatureImageUrl,
        contractSnapshot,
        req.ip,
        userAgent,
        hash,
      ],
    );

    await conn.execute(
      "UPDATE orders SET status = 'contract_signed' WHERE id = ? AND customer_id = ? AND status = 'quote_agreed'",
      [order.id, req.customer.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Contract_Signed', ?, ?)`,
      [order.id, `Kontrak ditandatangani secara digital oleh ${signerName} (hash ${hash.slice(0, 16)}...)`, req.user.userId],
    );

    await conn.commit();
    return ok(
      res,
      {
        order_id: order.id,
        status: 'contract_signed',
        signer_name: signerName,
        signer_title: signerTitle,
        signature_image_url: signatureImageUrl,
        signature_hash: hash,
        signed_at: timestamp,
      },
      'Kontrak digital berhasil ditandatangani dan dikunci.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('signContract error:', error);
    return fail(res, 500, 'Penandatanganan kontrak gagal.');
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------------
// 4. Pembayaran DP
// ---------------------------------------------------------------------------
exports.submitDpPayment = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOwnedOrder(req.params.id, req.customer.id, conn);
    if (!order) {
      await conn.rollback();
      return fail(res, 404, 'PO tidak ditemukan.');
    }

    if (!['quote_agreed', 'contract_signed'].includes(order.status)) {
      await conn.rollback();
      return fail(res, 400, 'Bukti DP hanya dapat dikirim setelah harga penawaran disepakati (quote_agreed).');
    }
    if (!(Number(order.total_order_value) > 0)) {
      await conn.rollback();
      return fail(res, 400, 'Nilai pesanan belum valid untuk pembayaran DP.');
    }
    if (!req.file) {
      await conn.rollback();
      return fail(res, 400, 'Bukti transfer DP (payment_proof) wajib diunggah.');
    }

    const paidAmount = Number(req.body.paid_amount);
    if (!(paidAmount > 0)) {
      await conn.rollback();
      return fail(res, 400, 'Nominal DP tidak valid.');
    }

    const [[credit]] = await conn.execute(
      'SELECT required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1',
      [req.customer.id],
    );
    const dpPercent = order.required_dp_percent !== null
      ? Number(order.required_dp_percent)
      : credit ? Number(credit.required_dp_percent) : 30;
    const requiredDpAmount = (Number(order.total_order_value) * dpPercent) / 100;

    if (paidAmount < requiredDpAmount) {
      await conn.rollback();
      return fail(
        res,
        400,
        `Nominal DP minimal Rp ${requiredDpAmount.toLocaleString('id-ID')} (${dpPercent}% dari nilai PO).`,
      );
    }

    const proofUrl = `/uploads/payments/${req.file.filename}`;
    const paymentDate = req.body.payment_date ? new Date(req.body.payment_date) : new Date();

    const [[existing]] = await conn.execute(
      'SELECT id FROM dp_payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [order.id],
    );

    let dpPaymentId;
    if (existing) {
      await conn.execute(
        `UPDATE dp_payments
         SET required_dp_percent = ?, required_dp_amount = ?, paid_amount = ?,
             payment_date = ?, payment_proof_url = ?,
             verification_status = 'pending', verified_by = NULL, rejection_notes = NULL
         WHERE id = ?`,
        [dpPercent, requiredDpAmount, paidAmount, paymentDate, proofUrl, existing.id],
      );
      dpPaymentId = existing.id;
    } else {
      const [result] = await conn.execute(
        `INSERT INTO dp_payments (order_id, required_dp_percent, required_dp_amount, paid_amount, payment_date, payment_proof_url, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [order.id, dpPercent, requiredDpAmount, paidAmount, paymentDate, proofUrl],
      );
      dpPaymentId = result.insertId;
    }

    await conn.execute(
      "UPDATE orders SET status = 'dp_pending' WHERE id = ? AND customer_id = ? AND status IN ('quote_agreed', 'contract_signed')",
      [order.id, req.customer.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Contract_Signed', ?, ?)`,
      [
        order.id,
        `Bukti transfer DP sebesar Rp ${paidAmount.toLocaleString('id-ID')} (${dpPercent}%) diunggah oleh Customer, menunggu verifikasi Admin.`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return ok(
      res,
      {
        dp_payment_id: dpPaymentId,
        status: 'dp_pending',
        verification_status: 'pending',
        required_dp_amount: requiredDpAmount,
        paid_amount: paidAmount,
        payment_proof_url: proofUrl,
      },
      'Bukti DP terkirim, menunggu verifikasi Admin.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('submitDpPayment error:', error);
    return fail(res, 500, 'Pengiriman bukti DP gagal.');
  } finally {
    conn.release();
  }
};

async function getCuttingSummary(orderId) {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS total_jobs,
            COALESCE(SUM(status = 'completed'), 0) AS completed_jobs,
            COALESCE(SUM(status = 'in_progress'), 0) AS in_progress_jobs,
            COALESCE(SUM(status = 'pending'), 0) AS pending_jobs,
            MAX(finished_at) AS last_finished_at,
            MAX(created_at) AS last_created_at
     FROM cutting_jobs
     WHERE order_id = ?`,
    [orderId],
  );
  const totalJobs = Number(row?.total_jobs || 0);
  const completedJobs = Number(row?.completed_jobs || 0);
  const inProgressJobs = Number(row?.in_progress_jobs || 0);
  const pendingJobs = Number(row?.pending_jobs || 0);

  return {
    total_jobs: totalJobs,
    completed_jobs: completedJobs,
    in_progress_jobs: inProgressJobs,
    pending_jobs: pendingJobs,
    all_completed: totalJobs > 0 && completedJobs >= totalJobs,
    last_finished_at: row?.last_finished_at || null,
    last_created_at: row?.last_created_at || null,
  };
}

function buildCustomerTimeline(logs, cuttingSummary, fallbackDate) {
  const nonCuttingLogs = [];
  const cuttingLogs = [];
  for (const log of logs || []) {
    if (log.stage === 'Cutting') cuttingLogs.push(log);
    else nonCuttingLogs.push(log);
  }

  let consolidatedCutting = null;
  const totalJobs = Number(cuttingSummary?.total_jobs || 0);
  const completedJobs = Number(cuttingSummary?.completed_jobs || 0);
  const latestCuttingLog = cuttingLogs[cuttingLogs.length - 1] || null;

  if (totalJobs > 0) {
    const allCompleted = Boolean(cuttingSummary.all_completed);
    consolidatedCutting = {
      stage: 'Cutting',
      affected_quantity: null,
      status_description: allCompleted
        ? `Semua proses pemotongan (${completedJobs}/${totalJobs} job) telah selesai.`
        : `Proses pemotongan belum semua selesai (${completedJobs}/${totalJobs} job selesai).`,
      updated_at:
        latestCuttingLog?.updated_at ||
        (allCompleted ? cuttingSummary.last_finished_at : cuttingSummary.last_created_at) ||
        fallbackDate ||
        null,
      is_completed: allCompleted,
    };
  } else if (cuttingLogs.length > 0) {
    const isCompleted = String(latestCuttingLog.status_description || '')
      .toLowerCase()
      .includes('selesai');
    consolidatedCutting = {
      stage: 'Cutting',
      affected_quantity: latestCuttingLog.affected_quantity ?? null,
      status_description: isCompleted
        ? 'Semua proses pemotongan telah selesai.'
        : 'Proses pemotongan sedang berlangsung (belum semua selesai).',
      updated_at: latestCuttingLog.updated_at || fallbackDate || null,
      is_completed: isCompleted,
    };
  }

  if (!consolidatedCutting) return nonCuttingLogs;

  const combined = [...nonCuttingLogs, consolidatedCutting];
  combined.sort((a, b) => {
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return ta - tb;
  });
  return combined;
}

// ---------------------------------------------------------------------------
// 5. Live Tracking & Konfirmasi Penerimaan
// ---------------------------------------------------------------------------
exports.getTracking = async (req, res) => {
  try {
    const order = await getOwnedOrder(req.params.id, req.customer.id);
    if (!order) return fail(res, 404, 'PO tidak ditemukan.');

    const [logs] = await db.execute(
      `SELECT stage, affected_quantity, status_description, updated_at
       FROM po_tracking_logs WHERE order_id = ? ORDER BY updated_at ASC`,
      [order.id],
    );
    const cuttingSummary = await getCuttingSummary(order.id);
    const timeline = buildCustomerTimeline(logs, cuttingSummary, order.order_date);

    const [deliveries] = await db.execute(
      `SELECT d.id, d.delivery_note_number, d.delivery_date, d.truck_plate_number, d.driver_name,
              d.quantity_shipped, d.received_status, d.received_date,
              (SELECT COALESCE(SUM(di.quantity_shipped), 0) FROM delivery_items di WHERE di.delivery_id = d.id) AS total_items_shipped
       FROM deliveries d WHERE d.order_id = ? ORDER BY d.delivery_date ASC`,
      [order.id],
    );

    return ok(res, { order, timeline, cutting_summary: cuttingSummary, deliveries });
  } catch (error) {
    console.error('getTracking error:', error);
    return fail(res, 500, 'Tracking gagal dimuat.');
  }
};

exports.confirmDelivery = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT d.id, d.order_id, d.quantity_shipped
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.id = ? AND o.customer_id = ?
       LIMIT 1`,
      [req.params.id, req.customer.id],
    );
    if (!rows.length) {
      await conn.rollback();
      return fail(res, 404, 'Pengiriman tidak ditemukan untuk akun Anda.');
    }
    const delivery = rows[0];

    await conn.execute(
      'UPDATE deliveries SET received_status = TRUE, received_date = CURDATE() WHERE id = ?',
      [delivery.id],
    );

    // Cek apakah seluruh kuantitas PO sudah diterima
    const [[totals]] = await conn.execute(
      `SELECT
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = ?) AS total_ordered,
         (SELECT COALESCE(SUM(quantity_shipped), 0) FROM deliveries WHERE order_id = ? AND received_status = TRUE) AS total_received`,
      [delivery.order_id, delivery.order_id],
    );
    const allReceived = Number(totals.total_ordered) > 0 && Number(totals.total_received) >= Number(totals.total_ordered);

    if (allReceived) {
      await conn.execute("UPDATE orders SET status = 'completed' WHERE id = ?", [delivery.order_id]);
    }

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, affected_quantity, status_description, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        delivery.order_id,
        allReceived ? 'Completed' : 'Shipping',
        delivery.quantity_shipped,
        allReceived
          ? `Seluruh pengiriman PO selesai dikonfirmasi diterima oleh customer (${totals.total_received}/${totals.total_ordered} pcs).`
          : `Pengiriman parsial #${delivery.id} (${delivery.quantity_shipped} pcs) dikonfirmasi diterima (${totals.total_received}/${totals.total_ordered} pcs).`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return ok(
      res,
      {
        delivery_id: Number(delivery.id),
        received_status: true,
        order_completed: allReceived,
        total_received: Number(totals.total_received),
        total_ordered: Number(totals.total_ordered),
      },
      allReceived ? 'Seluruh pengiriman PO telah diterima dan selesai.' : 'Penerimaan pengiriman parsial dikonfirmasi.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('confirmDelivery error:', error);
    return fail(res, 500, 'Konfirmasi penerimaan gagal.');
  } finally {
    conn.release();
  }
};

exports.payInvoice = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT i.id, i.total_amount, i.paid_amount, i.status
       FROM invoices i JOIN orders o ON o.id = i.order_id
       WHERE i.id = ? AND o.customer_id = ?
       LIMIT 1`,
      [req.params.id, req.customer.id],
    );
    const invoice = rows[0];
    if (!invoice) {
      await conn.rollback();
      return fail(res, 404, 'Tagihan tidak ditemukan untuk akun Anda.');
    }
    if (invoice.status === 'paid') {
      await conn.rollback();
      return fail(res, 409, 'Tagihan ini sudah lunas.');
    }

    const amount = Number(req.body.amount_paid);
    if (!(amount > 0)) {
      await conn.rollback();
      return fail(res, 400, 'Nominal pembayaran tidak valid.');
    }
    if (!req.file) {
      await conn.rollback();
      return fail(res, 400, 'Bukti transfer pelunasan wajib diunggah.');
    }

    const paymentNumber = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const proofUrl = `/uploads/payments/${req.file.filename}`;

    // Catat sebagai pending; saldo invoice baru bertambah setelah diverifikasi Admin
    await conn.execute(
      `INSERT INTO invoice_payments (
         invoice_id, payment_number, payment_date, amount_paid,
         payment_method, payment_proof_url, verification_status
       ) VALUES (?, ?, CURDATE(), ?, ?, ?, 'pending')`,
      [invoice.id, paymentNumber, amount, req.body.payment_method || 'bank_transfer', proofUrl],
    );

    await conn.commit();
    return ok(
      res,
      {
        invoice_id: invoice.id,
        payment_number: paymentNumber,
        submitted_amount: amount,
        verification_status: 'pending',
        status: invoice.status,
      },
      'Bukti pembayaran terkirim, menunggu verifikasi Admin.',
    );
  } catch (error) {
    await conn.rollback();
    console.error('payInvoice error:', error);
    return fail(res, 500, 'Pembayaran tagihan gagal diproses.');
  } finally {
    conn.release();
  }
};
// ---------------------------------------------------------------------------
// 6. Tagihan TOP 90 Hari & Pelunasan
// ---------------------------------------------------------------------------
exports.getInvoices = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.total_amount, i.paid_amount, i.status,
              (i.total_amount - i.paid_amount) AS remaining_amount,
              DATEDIFF(i.due_date, CURDATE()) AS days_until_due,
              (SELECT COUNT(*) FROM invoice_payments ip WHERE ip.invoice_id = i.id) AS payment_records
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       WHERE o.customer_id = ?
       ORDER BY i.due_date ASC`,
      [req.customer.id],
    );
    return ok(res, rows);
  } catch (error) {
    console.error('getInvoices error:', error);
    return fail(res, 500, 'Daftar tagihan gagal dimuat.');
  }
};

// ---------------------------------------------------------------------------
// 7. Retur & Klaim Cacat (RMA)
// ---------------------------------------------------------------------------
exports.listRma = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.rma_number, r.request_date, r.claim_reason, r.verification_status,
              r.action_type, r.credit_note_amount, r.order_id, o.order_number
       FROM rma_requests r
       JOIN orders o ON o.id = r.order_id
       WHERE r.customer_id = ?
       ORDER BY r.request_date DESC`,
      [req.customer.id],
    );
    return ok(res, rows);
  } catch (error) {
    console.error('listRma error:', error);
    return fail(res, 500, 'Daftar RMA gagal dimuat.');
  }
};

exports.createRma = async (req, res) => {
  try {
    const orderId = Number(req.body.order_id);
    const deliveryId = Number(req.body.delivery_id);
    const defectQty = Number(req.body.defect_quantity);
    const actionType = ['replacement', 'credit_note'].includes(req.body.action_type)
      ? req.body.action_type
      : 'replacement';

    if (!(defectQty > 0)) return fail(res, 400, 'Jumlah unit cacat (defect_quantity) wajib diisi.');
    if (!req.file) return fail(res, 400, 'Bukti foto/video cacat (proof_media) wajib diunggah.');

    const order = await getOwnedOrder(orderId, req.customer.id);
    if (!order) return fail(res, 404, 'PO tidak ditemukan untuk akun Anda.');

    const [del] = await db.execute(
      'SELECT id FROM deliveries WHERE id = ? AND order_id = ? LIMIT 1',
      [deliveryId, orderId],
    );
    if (!del.length) return fail(res, 404, 'Pengiriman tidak ditemukan pada PO ini.');

    const rmaNumber = `RMA-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const proofUrl = `/uploads/rma/${req.file.filename}`;
    const reason = `[defect_quantity: ${defectQty}] ${String(req.body.claim_reason || '').trim()}`;

    await db.execute(
      `INSERT INTO rma_requests (rma_number, order_id, delivery_id, customer_id, proof_media_url, claim_reason, action_type, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [rmaNumber, orderId, deliveryId, req.customer.id, proofUrl, reason, actionType],
    );

    return ok(res, { rma_number: rmaNumber, status: 'pending' }, 'Klaim RMA terkirim, menunggu verifikasi QC.');
  } catch (error) {
    console.error('createRma error:', error);
    return fail(res, 500, 'Pengajuan RMA gagal.');
  }
};
