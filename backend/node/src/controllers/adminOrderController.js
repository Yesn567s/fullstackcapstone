const crypto = require("crypto");

const db = require("../config/db");

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
              o.total_order_value, o.status, c.company_name,
              COALESCE((
                SELECT SUM(oi.quantity) FROM order_items oi
                WHERE oi.order_id = o.id
              ), 0) AS total_units
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
              o.total_order_value, o.status, c.company_name, c.contact_person,
              c.email, c.phone
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
      `SELECT drawer_type_code, finished_length_mm, finished_width_mm,
              finished_height_mm, quantity, unit_price
       FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [orderId],
    );
    return res.json({ success: true, data: { ...order, items } });
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

module.exports = {
  createOrder,
  getOrderDetail,
  listCustomers,
  listOrders,
};
