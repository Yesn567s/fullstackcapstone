const crypto = require("crypto");

const db = require("../config/db");
const { ensureOrderComponents } = require("../services/cuttingOptimizationService");

function generateOrderNumber() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `PO-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function listCustomers(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT id, company_name
       FROM customers
       ORDER BY company_name ASC`,
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List admin order customers error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar customer tidak dapat dimuat saat ini.",
    });
  }
}

async function listOrders(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, o.order_date, o.top_days,
              o.total_order_value, o.required_dp_percent, o.drawing_file_url,
              o.negotiation_round, o.status, c.company_name,
              COALESCE((
                SELECT SUM(oi.quantity) FROM order_items oi
                WHERE oi.order_id = o.id
              ), 0) AS total_units,
              (
                SELECT dp.verification_status FROM dp_payments dp
                WHERE dp.order_id = o.id ORDER BY dp.id DESC LIMIT 1
              ) AS dp_verification_status
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       ORDER BY o.order_date DESC, o.id DESC`,
    );
    const [[summary]] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM orders
          WHERE status NOT IN ('completed', 'cancelled')) AS active_orders,
         (SELECT COUNT(*) FROM orders
          WHERE status IN ('ready_for_production', 'in_production')) AS production_orders,
         (SELECT COALESCE(SUM(oi.quantity), 0)
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          WHERE o.status IN ('ready_for_production', 'in_production')) AS production_units,
         (SELECT COALESCE(ROUND(AVG(top_days)), 0) FROM orders
          WHERE status NOT IN ('completed', 'cancelled')) AS average_top_days`,
    );

    return res.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error("List admin orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar transaksi PO tidak dapat dimuat saat ini.",
    });
  }
}

async function getOrderDetail(req, res) {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({
      success: false,
      message: "ID PO tidak valid.",
    });
  }

  try {
    const [[order]] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, o.order_date, o.top_days,
              o.total_order_value, o.required_dp_percent, o.drawing_file_url,
              o.negotiation_round, o.agreed_at, o.agreed_by_role, o.notes, o.status,
              o.customer_id, c.company_name, c.contact_person, c.email, c.phone
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId],
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "PO tidak ditemukan.",
      });
    }

    const [items] = await db.execute(
      `SELECT oi.id, oi.material_id, m.material_name, oi.drawer_type_code,
              oi.finished_length_mm, oi.finished_width_mm,
              oi.finished_height_mm, oi.quantity, oi.unit_price
       FROM order_items oi
       LEFT JOIN materials m ON m.id = oi.material_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId],
    );

    const [[credit]] = await db.execute(
      `SELECT credit_score, recommended_credit_limit, allow_top_90, required_dp_percent
       FROM customer_credit_scores
       WHERE customer_id = ?
       LIMIT 1`,
      [order.customer_id],
    );

    const [rounds] = await db.execute(
      `SELECT n.*, u.full_name AS proposed_by_name
       FROM order_negotiations n
       LEFT JOIN users u ON u.id = n.proposed_by_user_id
       WHERE n.order_id = ?
       ORDER BY n.round_number ASC, n.id ASC`,
      [orderId],
    );

    let negotiations = [];
    if (rounds.length) {
      const placeholders = rounds.map(() => "?").join(",");
      const [negItems] = await db.execute(
        `SELECT ni.*, oi.drawer_type_code
         FROM order_negotiation_items ni
         JOIN order_items oi ON oi.id = ni.order_item_id
         WHERE ni.negotiation_id IN (${placeholders})
         ORDER BY ni.id ASC`,
        rounds.map((r) => r.id),
      );
      const byNeg = new Map();
      for (const ni of negItems) {
        if (!byNeg.has(ni.negotiation_id)) byNeg.set(ni.negotiation_id, []);
        byNeg.get(ni.negotiation_id).push(ni);
      }
      negotiations = rounds.map((r) => ({ ...r, items: byNeg.get(r.id) || [] }));
    }

    const [[contract]] = await db.execute(
      "SELECT * FROM contract_approvals WHERE order_id = ? LIMIT 1",
      [orderId],
    );
    const [dpPayments] = await db.execute(
      "SELECT * FROM dp_payments WHERE order_id = ? ORDER BY id DESC",
      [orderId],
    );

    return res.json({
      success: true,
      data: {
        ...order,
        items,
        credit: credit || null,
        negotiations,
        contract: contract || null,
        dp_payments: dpPayments,
      },
    });
  } catch (error) {
    console.error("Get admin order detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Detail PO tidak dapat dimuat saat ini.",
    });
  }
}

async function createOrder(req, res) {
  const {
    customer_id: customerId,
    po_number: requestedPoNumber,
    order_date: orderDate,
    top_days: topDays,
    drawer_type_code: drawerTypeCode,
    length_mm: lengthMm,
    width_mm: widthMm,
    height_mm: heightMm,
    quantity,
  } = req.body;
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [[customer]] = await connection.execute(
      "SELECT id FROM customers WHERE id = ? FOR UPDATE",
      [customerId],
    );
    if (!customer) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Customer yang dipilih tidak ditemukan.",
      });
    }

    const orderNumber = generateOrderNumber();
    const poNumber = requestedPoNumber || orderNumber;
    const formattedOrderDate = orderDate.toISOString().slice(0, 10);
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
         order_number, customer_id, po_number, order_date, top_days,
         total_order_value, status
       ) VALUES (?, ?, ?, ?, ?, 0, 'draft')`,
      [orderNumber, customerId, poNumber, formattedOrderDate, topDays],
    );
    const orderId = orderResult.insertId;

    await connection.execute(
      `INSERT INTO order_items (
         order_id, drawer_type_code, finished_length_mm, finished_width_mm,
         finished_height_mm, quantity, unit_price
       ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [orderId, drawerTypeCode, lengthMm, widthMm, heightMm, quantity],
    );
    await connection.execute(
      `INSERT INTO po_tracking_logs (
         order_id, stage, status_description, updated_by
       ) VALUES (?, 'PO_Created', ?, ?)`,
      [orderId, `PO ${orderNumber} dibuat oleh admin`, req.admin.id],
    );

    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      success: true,
      message: "PO berhasil dibuat.",
      data: {
        id: orderId,
        order_number: orderNumber,
        po_number: poNumber,
        order_date: formattedOrderDate,
        top_days: topDays,
        status: "draft",
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Create admin order rollback error:", rollbackError);
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Nomor PO sudah digunakan. Gunakan nomor PO lain.",
      });
    }
    console.error("Create admin order error:", error);
    return res.status(500).json({
      success: false,
      message: "PO tidak dapat dibuat saat ini.",
    });
  } finally {
    connection.release();
  }
}

async function counterOffer(req, res) {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({ success: false, message: "ID PO tidak valid." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[order]] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [orderId],
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "PO tidak ditemukan." });
    }
    if (order.status !== "negotiating_admin_review") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Counter-offer Admin hanya dapat dilakukan saat PO berstatus menunggu review Admin.",
      });
    }

    const [orderItems] = await connection.execute(
      "SELECT id, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC",
      [orderId],
    );
    const priceByItemId = new Map(
      req.body.items.map((it) => [Number(it.order_item_id), Number(it.proposed_unit_price)]),
    );

    let proposedTotal = 0;
    const roundItems = [];
    for (const oi of orderItems) {
      const price = priceByItemId.get(oi.id);
      if (!(price > 0)) {
        await connection.rollback();
        return res.status(422).json({
          success: false,
          message: `Harga counter-offer untuk item #${oi.id} wajib diisi.`,
        });
      }
      const subtotal = Number(oi.quantity) * price;
      proposedTotal += subtotal;
      roundItems.push({ order_item_id: oi.id, quantity: Number(oi.quantity), unit_price: price, subtotal });
    }

    const [[credit]] = await connection.execute(
      "SELECT allow_top_90, required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1",
      [order.customer_id],
    );
    const proposedTopDays =
      req.body.proposed_top_days !== undefined
        ? Number(req.body.proposed_top_days)
        : credit && !credit.allow_top_90
          ? 0
          : Number(order.top_days || 90);
    const proposedDpPercent =
      req.body.proposed_dp_percent !== undefined
        ? Number(req.body.proposed_dp_percent)
        : credit
          ? Number(credit.required_dp_percent)
          : Number(order.required_dp_percent || 30);

    await connection.execute(
      "UPDATE order_negotiations SET status = 'countered' WHERE order_id = ? AND status = 'open'",
      [orderId],
    );

    const nextRound = Number(order.negotiation_round || 1) + 1;
    const notes = String(req.body.notes || "").trim() || null;

    const [negRes] = await connection.execute(
      `INSERT INTO order_negotiations (
         order_id, round_number, proposed_by_role, proposed_by_user_id,
         action_type, proposed_total_value, proposed_top_days, proposed_dp_percent,
         notes, status
       ) VALUES (?, ?, 'admin', ?, 'counter_offer', ?, ?, ?, ?, 'open')`,
      [
        orderId,
        nextRound,
        req.admin.id || null,
        proposedTotal,
        proposedTopDays,
        proposedDpPercent,
        notes,
      ],
    );

    for (const ri of roundItems) {
      await connection.execute(
        `INSERT INTO order_negotiation_items (negotiation_id, order_item_id, proposed_unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [negRes.insertId, ri.order_item_id, ri.unit_price, ri.quantity, ri.subtotal],
      );
    }

    await connection.execute(
      `UPDATE orders
       SET status = 'negotiating_customer_review',
           negotiation_round = ?,
           total_order_value = ?,
           top_days = ?,
           required_dp_percent = ?
       WHERE id = ?`,
      [nextRound, proposedTotal, proposedTopDays, proposedDpPercent, orderId],
    );

    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Counter_Offer', ?, ?)`,
      [
        orderId,
        `Admin mengirim counter-offer ronde #${nextRound} senilai Rp ${proposedTotal.toLocaleString("id-ID")} (DP ${proposedDpPercent}%, TOP ${proposedTopDays} hari).`,
        req.admin.id || null,
      ],
    );

    await connection.commit();
    return res.json({
      success: true,
      message: "Counter-offer berhasil dikirim ke Customer.",
      data: {
        order_id: orderId,
        round_number: nextRound,
        status: "negotiating_customer_review",
        proposed_total_value: proposedTotal,
        proposed_top_days: proposedTopDays,
        proposed_dp_percent: proposedDpPercent,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Admin counterOffer error:", error);
    return res.status(500).json({ success: false, message: "Counter-offer gagal dikirim." });
  } finally {
    connection.release();
  }
}

async function acceptOffer(req, res) {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({ success: false, message: "ID PO tidak valid." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[order]] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [orderId],
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "PO tidak ditemukan." });
    }
    if (order.status !== "negotiating_admin_review") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Penawaran hanya dapat disetujui Admin saat PO berstatus menunggu review Admin.",
      });
    }

    const [[openNeg]] = await connection.execute(
      `SELECT * FROM order_negotiations
       WHERE order_id = ? AND status = 'open' AND proposed_by_role = 'customer'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [orderId],
    );
    if (!openNeg) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Penawaran terbuka dari Customer tidak ditemukan." });
    }

    const [negItems] = await connection.execute(
      "SELECT * FROM order_negotiation_items WHERE negotiation_id = ?",
      [openNeg.id],
    );
    let agreedTotal = 0;
    for (const ni of negItems) {
      await connection.execute("UPDATE order_items SET unit_price = ? WHERE id = ? AND order_id = ?", [
        ni.proposed_unit_price,
        ni.order_item_id,
        orderId,
      ]);
      agreedTotal += Number(ni.proposed_unit_price) * Number(ni.quantity);
    }
    if (agreedTotal <= 0) agreedTotal = Number(openNeg.proposed_total_value);

    const [[credit]] = await connection.execute(
      "SELECT allow_top_90, required_dp_percent FROM customer_credit_scores WHERE customer_id = ? LIMIT 1",
      [order.customer_id],
    );
    const agreedTopDays =
      req.body.top_days !== undefined
        ? Number(req.body.top_days)
        : credit && !credit.allow_top_90
          ? 0
          : Number(order.top_days || 90);
    const agreedDpPercent =
      req.body.required_dp_percent !== undefined
        ? Number(req.body.required_dp_percent)
        : credit
          ? Number(credit.required_dp_percent)
          : Number(order.required_dp_percent || 30);

    await connection.execute("UPDATE order_negotiations SET status = 'accepted' WHERE id = ?", [openNeg.id]);

    const nextRound = Number(order.negotiation_round || 1) + 1;
    await connection.execute(
      `INSERT INTO order_negotiations (
         order_id, round_number, proposed_by_role, proposed_by_user_id,
         action_type, proposed_total_value, proposed_top_days, proposed_dp_percent,
         notes, status
       ) VALUES (?, ?, 'admin', ?, 'accept', ?, ?, ?, ?, 'accepted')`,
      [
        orderId,
        nextRound,
        req.admin.id || null,
        agreedTotal,
        agreedTopDays,
        agreedDpPercent,
        String(req.body.notes || "Admin menyetujui penawaran harga Customer.").trim(),
      ],
    );

    await connection.execute(
      `UPDATE orders
       SET status = 'quote_agreed',
           total_order_value = ?,
           top_days = ?,
           required_dp_percent = ?,
           negotiation_round = ?,
           agreed_at = NOW(),
           agreed_by_role = 'admin'
       WHERE id = ?`,
      [agreedTotal, agreedTopDays, agreedDpPercent, nextRound, orderId],
    );

    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Quote_Agreed', ?, ?)`,
      [
        orderId,
        `Admin menyetujui penawaran Rp ${agreedTotal.toLocaleString("id-ID")} (DP ${agreedDpPercent}%, TOP ${agreedTopDays} hari). Customer dapat menandatangani kontrak digital.`,
        req.admin.id || null,
      ],
    );

    await connection.commit();
    return res.json({
      success: true,
      message: "Penawaran Customer disetujui. Kontrak digital kini terbuka untuk Customer.",
      data: {
        order_id: orderId,
        status: "quote_agreed",
        total_order_value: agreedTotal,
        top_days: agreedTopDays,
        required_dp_percent: agreedDpPercent,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Admin acceptOffer error:", error);
    return res.status(500).json({ success: false, message: "Persetujuan penawaran gagal diproses." });
  } finally {
    connection.release();
  }
}

async function verifyDpPayment(req, res) {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({ success: false, message: "ID PO tidak valid." });
  }

  const { action, rejection_notes: rejectionNotes } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[order]] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
      [orderId],
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "PO tidak ditemukan." });
    }
    if (order.status !== "dp_pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Verifikasi DP hanya berlaku untuk PO berstatus dp_pending.",
      });
    }

    const [[dp]] = await connection.execute(
      "SELECT * FROM dp_payments WHERE order_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [orderId],
    );
    if (!dp) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Data bukti DP tidak ditemukan." });
    }

    if (action === "verify") {
      await connection.execute(
        `UPDATE dp_payments
         SET verification_status = 'verified', verified_by = ?, rejection_notes = NULL
         WHERE id = ?`,
        [req.admin.id || null, dp.id],
      );
      await connection.execute(
        "UPDATE orders SET status = 'ready_for_production' WHERE id = ?",
        [orderId],
      );
      await ensureOrderComponents(connection, orderId, order.customer_id);
      await connection.execute(
        `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
         VALUES (?, 'DP_Verified', ?, ?)`,
        [
          orderId,
          `DP sebesar Rp ${Number(dp.paid_amount).toLocaleString("id-ID")} diverifikasi Admin. PO masuk antrean produksi.`,
          req.admin.id || null,
        ],
      );
    } else {
      await connection.execute(
        `UPDATE dp_payments
         SET verification_status = 'rejected', verified_by = ?, rejection_notes = ?
         WHERE id = ?`,
        [req.admin.id || null, rejectionNotes || "Bukti DP ditolak Admin, silakan unggah ulang.", dp.id],
      );
      await connection.execute(
        "UPDATE orders SET status = 'contract_signed' WHERE id = ?",
        [orderId],
      );
    }

    await connection.commit();
    return res.json({
      success: true,
      message:
        action === "verify"
          ? "DP berhasil diverifikasi. PO kini berstatus ready_for_production dan panel komponen siap dioptimasi."
          : "Bukti DP ditolak. Customer diminta mengunggah ulang bukti transfer.",
      data: {
        order_id: orderId,
        status: action === "verify" ? "ready_for_production" : "contract_signed",
        verification_status: action === "verify" ? "verified" : "rejected",
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Admin verifyDpPayment error:", error);
    return res.status(500).json({ success: false, message: "Verifikasi DP gagal diproses." });
  } finally {
    connection.release();
  }
}

module.exports = {
  acceptOffer,
  counterOffer,
  createOrder,
  getOrderDetail,
  listCustomers,
  listOrders,
  verifyDpPayment,
};