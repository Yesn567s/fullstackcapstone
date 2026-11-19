// src/controllers/customerController.js
// Seluruh endpoint Role Customer (Buyer B2B) — isolasi ketat via req.customer.id
// -----------------------------------------------------------------------------
const crypto = require('crypto');
const db = require('../config/db');

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

    return ok(res, {
      customer,
      credit,
      order_stats: orderStats,
      consignment_remaining_sheets: Number(consignment[0].remaining_sheets),
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    return fail(res, 500, 'Dashboard customer tidak dapat dimuat saat ini.');
  }
};

// ---------------------------------------------------------------------------
// 2. PO MTO — buat, daftar, detail
// ---------------------------------------------------------------------------
exports.createOrder = async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 400, 'Minimal satu item laci (P x L x T) harus diisi.');
  }
  for (const it of items) {
    const { length_mm, width_mm, height_mm, quantity } = it;
    if (![length_mm, width_mm, height_mm, quantity].every((v) => Number(v) > 0)) {
      return fail(res, 400, 'Setiap item butuh length_mm, width_mm, height_mm, dan quantity bernilai positif.');
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const orderNumber = generateOrderNumber();
    const orderDate = new Date().toISOString().slice(0, 10);

    const [orderResult] = await conn.execute(
      `INSERT INTO orders (order_number, customer_id, po_number, order_date, top_days, total_order_value, status)
       VALUES (?, ?, ?, ?, 90, ?, 'draft')`,
      [orderNumber, req.customer.id, req.body.po_number || orderNumber, orderDate, 0],
    );
    const orderId = orderResult.insertId;

    for (const it of items) {
      await conn.execute(
        `INSERT INTO order_items
         (order_id, drawer_type_code, finished_length_mm, finished_width_mm, finished_height_mm, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          String(it.drawer_type_code || 'MTO').slice(0, 50),
          it.length_mm,
          it.width_mm,
          it.height_mm,
          it.quantity,
          it.unit_price || 0,
        ],
      );
    }

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'PO_Created', ?, ?)`,
      [orderId, `PO ${orderNumber} dibuat oleh customer`, req.user.userId],
    );

    await conn.commit();
    return ok(res, { order_id: orderId, order_number: orderNumber }, 'PO berhasil dibuat, menunggu kontrak digital.');
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
      `SELECT o.id, o.order_number, o.po_number, o.order_date, o.top_days, o.total_order_value, o.status,
              (SELECT COUNT(*) FROM contract_approvals ca WHERE ca.order_id = o.id) AS contract_signed,
              (SELECT COALESCE(SUM(dp.paid_amount), 0) FROM dp_payments dp WHERE dp.order_id = o.id) AS dp_paid,
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

    const [items] = await db.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const [approvals] = await db.execute('SELECT * FROM contract_approvals WHERE order_id = ?', [order.id]);
    const [dps] = await db.execute('SELECT * FROM dp_payments WHERE order_id = ?', [order.id]);
    const [tracking] = await db.execute(
      'SELECT stage, affected_quantity, status_description, updated_at FROM po_tracking_logs WHERE order_id = ? ORDER BY updated_at ASC',
      [order.id],
    );
    const [deliveries] = await db.execute(
      `SELECT d.*, (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = d.id) AS item_lines
       FROM deliveries d WHERE d.order_id = ?`,
      [order.id],
    );
    const [invoices] = await db.execute('SELECT * FROM invoices WHERE order_id = ?', [order.id]);

    return ok(res, { order, items, contract: approvals[0] || null, dp_payments: dps, tracking, deliveries, invoices });
  } catch (error) {
    console.error('getOrderDetail error:', error);
    return fail(res, 500, 'Detail PO gagal dimuat.');
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

    const [[approval]] = await db.execute(
      'SELECT * FROM contract_approvals WHERE order_id = ? LIMIT 1',
      [order.id],
    );

    return ok(res, { contract: contracts[0], approval: approval || null, order });
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

    const [[existing]] = await conn.execute(
      'SELECT id FROM contract_approvals WHERE order_id = ? LIMIT 1',
      [order.id],
    );
    if (existing) {
      await conn.rollback();
      return fail(res, 409, 'Kontrak untuk PO ini sudah ditandatangani sebelumnya.');
    }

    const [contracts] = await conn.execute(
      'SELECT id FROM legal_contracts WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1',
    );
    if (!contracts.length) {
      await conn.rollback();
      return fail(res, 404, 'Belum ada kontrak aktif untuk ditandatangani.');
    }
    const contractId = contracts[0].id;

    const timestamp = new Date().toISOString();
    const userAgent = req.headers['user-agent'] || '';
    const hash = crypto
      .createHash('sha256')
      .update(`${order.id}${req.customer.id}${contractId}${timestamp}${userAgent}`)
      .digest('hex');

    await conn.execute(
      `INSERT INTO contract_approvals (order_id, legal_contract_id, customer_id, ip_address, digital_signature_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [order.id, contractId, req.customer.id, req.ip, hash],
    );

    await conn.execute(
      "UPDATE orders SET status = 'contract_signed' WHERE id = ? AND customer_id = ? AND status = 'draft'",
      [order.id, req.customer.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Contract_Signed', ?, ?)`,
      [order.id, `Kontrak digital ditandatangani (hash ${hash.slice(0, 16)}...)`, req.user.userId],
    );

    await conn.commit();
    return ok(res, { order_id: order.id, signature_hash: hash, signed_at: timestamp }, 'Kontrak berhasil dikunci.');
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
  try {
    const order = await getOwnedOrder(req.params.id, req.customer.id);
    if (!order) return fail(res, 404, 'PO tidak ditemukan.');

    const paidAmount = Number(req.body.paid_amount);
    if (!(paidAmount > 0)) return fail(res, 400, 'Nominal DP tidak valid.');

    const [[credit]] = await db.execute(
      'SELECT required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1',
      [req.customer.id],
    );
    const dpPercent = credit ? Number(credit.required_dp_percent) : 30;
    const requiredDpAmount = (Number(order.total_order_value) * dpPercent) / 100;

    if (paidAmount < requiredDpAmount) {
      return fail(res, 400, `Nominal DP minimal ${requiredDpAmount} (${dpPercent}% dari nilai PO).`);
    }

    const proofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
    const paymentDate = req.body.payment_date ? new Date(req.body.payment_date) : new Date();

    const [[existing]] = await db.execute(
      'SELECT id, paid_amount FROM dp_payments WHERE order_id = ? LIMIT 1',
      [order.id],
    );

    if (existing) {
      await db.execute(
        `UPDATE dp_payments SET paid_amount = paid_amount + ?, payment_date = ?, payment_proof_url = COALESCE(?, payment_proof_url), verification_status = 'pending'
         WHERE id = ?`,
        [paidAmount, paymentDate, proofUrl, existing.id],
      );
      return ok(res, { dp_payment_id: existing.id, total_paid: Number(existing.paid_amount) + paidAmount }, 'Bukti DP diperbarui, menunggu verifikasi admin.');
    }

    const [result] = await db.execute(
      `INSERT INTO dp_payments (order_id, required_dp_percent, required_dp_amount, paid_amount, payment_date, payment_proof_url, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [order.id, dpPercent, requiredDpAmount, paidAmount, paymentDate, proofUrl],
    );

    await db.execute(
      "UPDATE orders SET status = 'dp_pending' WHERE id = ? AND customer_id = ? AND status = 'contract_signed'",
      [order.id, req.customer.id],
    );

    return ok(res, { dp_payment_id: result.insertId, required_dp_amount: requiredDpAmount }, 'Bukti DP terkirim, menunggu verifikasi admin.');
  } catch (error) {
    console.error('submitDpPayment error:', error);
    return fail(res, 500, 'Pengiriman bukti DP gagal.');
  }
};

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

    const [deliveries] = await db.execute(
      `SELECT d.id, d.delivery_note_number, d.delivery_date, d.truck_plate_number, d.driver_name,
              d.quantity_shipped, d.received_status, d.received_date,
              (SELECT COALESCE(SUM(di.quantity_shipped), 0) FROM delivery_items di WHERE di.delivery_id = d.id) AS total_items_shipped
       FROM deliveries d WHERE d.order_id = ? ORDER BY d.delivery_date ASC`,
      [order.id],
    );

    return ok(res, { order, timeline: logs, deliveries });
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
      `SELECT d.id FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.id = ? AND o.customer_id = ?
       LIMIT 1`,
      [req.params.id, req.customer.id],
    );
    if (!rows.length) {
      await conn.rollback();
      return fail(res, 404, 'Pengiriman tidak ditemukan untuk akun Anda.');
    }

    await conn.execute(
      'UPDATE deliveries SET received_status = TRUE, received_date = CURDATE() WHERE id = ?',
      [req.params.id],
    );

    const [[orderRow]] = await conn.execute(
      'SELECT order_id FROM deliveries WHERE id = ? LIMIT 1',
      [req.params.id],
    );

    await conn.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, affected_quantity, status_description, updated_by)
       VALUES (?, 'Completed', NULL, ?, ?)`,
      [
        orderRow.order_id,
        `Pengiriman #${req.params.id} dikonfirmasi diterima oleh customer`,
        req.user.userId,
      ],
    );

    await conn.commit();
    return ok(res, { delivery_id: Number(req.params.id), received_status: true }, 'Penerimaan barang dikonfirmasi.');
  } catch (error) {
    await conn.rollback();
    console.error('confirmDelivery error:', error);
    return fail(res, 500, 'Konfirmasi penerimaan gagal.');
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

    const paymentNumber = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const proofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    await conn.execute(
      `INSERT INTO invoice_payments (invoice_id, payment_number, payment_date, amount_paid, payment_method, payment_proof_url)
       VALUES (?, ?, CURDATE(), ?, ?, ?)`,
      [invoice.id, paymentNumber, amount, req.body.payment_method || 'bank_transfer', proofUrl],
    );

    const newPaid = Number(invoice.paid_amount) + amount;
    const newStatus = newPaid >= Number(invoice.total_amount) ? 'paid' : newPaid > 0 ? 'partially_paid' : invoice.status;
    await conn.execute('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, invoice.id]);

    await conn.commit();
    return ok(res, { invoice_id: invoice.id, payment_number: paymentNumber, paid_total: newPaid, status: newStatus }, 'Bukti pembayaran terkirim, menunggu verifikasi admin.');
  } catch (error) {
    await conn.rollback();
    console.error('payInvoice error:', error);
    return fail(res, 500, 'Pembayaran tagihan gagal diproses.');
  } finally {
    conn.release();
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
      `INSERT INTO rma_requests (rma_number, order_id, delivery_id, customer_id, proof_media_url, claim_reason, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [rmaNumber, orderId, deliveryId, req.customer.id, proofUrl, reason],
    );

    return ok(res, { rma_number: rmaNumber, status: 'pending' }, 'Klaim RMA terkirim, menunggu verifikasi QC.');
  } catch (error) {
    console.error('createRma error:', error);
    return fail(res, 500, 'Pengajuan RMA gagal.');
  }
};
