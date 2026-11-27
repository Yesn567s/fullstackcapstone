const crypto = require("crypto");

const db = require("../config/db");

async function listInvoices(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT i.id, i.invoice_number, i.order_id, i.invoice_date, i.due_date,
              i.total_amount, i.paid_amount,
              GREATEST(i.total_amount - i.paid_amount, 0) AS remaining_amount,
              CASE
                WHEN i.status IN ('unpaid', 'partially_paid')
                  AND i.due_date < CURDATE() THEN 'overdue'
                ELSE i.status
              END AS status,
              o.order_number, o.po_number, o.top_days, c.company_name
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       ORDER BY i.due_date ASC, i.id DESC`,
    );
    const [[summary]] = await db.execute(
      `SELECT
         COALESCE(SUM(
           CASE WHEN i.status IN ('unpaid', 'partially_paid', 'overdue')
             THEN GREATEST(i.total_amount - i.paid_amount, 0)
             ELSE 0 END
         ), 0) AS active_receivables,
         COALESCE(SUM(
           CASE WHEN i.status IN ('unpaid', 'partially_paid')
             AND i.due_date BETWEEN CURDATE()
               AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
             THEN GREATEST(i.total_amount - i.paid_amount, 0)
             ELSE 0 END
         ), 0) AS due_in_30_days,
         (SELECT COALESCE(SUM(ip.amount_paid), 0)
          FROM invoice_payments ip
          WHERE YEAR(ip.payment_date) = YEAR(CURDATE())
         ) AS paid_this_year,
         SUM(CASE WHEN i.status IN ('unpaid', 'partially_paid', 'overdue')
           THEN 1 ELSE 0 END) AS active_invoice_count,
         SUM(CASE WHEN i.status IN ('unpaid', 'partially_paid')
           AND i.due_date BETWEEN CURDATE()
             AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           THEN 1 ELSE 0 END) AS due_invoice_count
       FROM invoices i`,
    );

    return res.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error("List admin invoices error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar invoice tidak dapat dimuat saat ini.",
    });
  }
}

async function listAvailableOrders(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, o.top_days,
              o.total_order_value, c.company_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN invoices i ON i.order_id = o.id
       WHERE i.id IS NULL
         AND EXISTS (
           SELECT 1 FROM po_tracking_logs ptl
           WHERE ptl.order_id = o.id
             AND ptl.stage = 'Completed'
             AND ptl.status_description LIKE '%ACC Final%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM rma_requests r
           WHERE r.order_id = o.id
             AND r.verification_status = 'pending'
         )
       ORDER BY o.order_date DESC, o.id DESC`,
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List invoice orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar PO yang belum memiliki invoice tidak dapat dimuat.",
    });
  }
}

async function createInvoice(req, res) {
  const {
    order_id: orderId,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    total_amount: totalAmount,
  } = req.body;
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [[order]] = await connection.execute(
      "SELECT id FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    if (!order) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "PO yang dipilih tidak ditemukan.",
      });
    }

    const [[existingInvoice]] = await connection.execute(
      `SELECT id FROM invoices
       WHERE order_id = ? OR invoice_number = ?
       LIMIT 1`,
      [orderId, invoiceNumber],
    );
    if (existingInvoice) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message:
          "PO tersebut sudah memiliki invoice atau nomor invoice sudah digunakan.",
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO invoices (
         invoice_number, order_id, invoice_date, due_date,
         total_amount, paid_amount, status
       ) VALUES (?, ?, ?, ?, ?, 0, 'unpaid')`,
      [
        invoiceNumber,
        orderId,
        invoiceDate.toISOString().slice(0, 10),
        dueDate.toISOString().slice(0, 10),
        totalAmount,
      ],
    );
    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Invoice berhasil dibuat.",
      data: {
        id: result.insertId,
        invoice_number: invoiceNumber,
        order_id: orderId,
        invoice_date: invoiceDate.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
        total_amount: totalAmount,
        paid_amount: 0,
        status: "unpaid",
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Create invoice rollback error:", rollbackError);
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "PO tersebut sudah memiliki invoice atau nomor invoice sudah digunakan.",
      });
    }

    console.error("Create admin invoice error:", error);
    return res.status(500).json({
      success: false,
      message: "Invoice tidak dapat dibuat saat ini.",
    });
  } finally {
    if (connection) connection.release();
  }
}

async function recordPayment(req, res) {
  const invoiceId = Number(req.params.id);
  if (!Number.isInteger(invoiceId) || invoiceId < 1) {
    return res.status(422).json({
      success: false,
      message: "ID invoice tidak valid.",
    });
  }

  const {
    amount_paid: amountPaid,
    payment_date: paymentDate,
    payment_method: paymentMethod,
    notes,
  } = req.body;
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [[invoice]] = await connection.execute(
      `SELECT id, invoice_number, total_amount, paid_amount, due_date
       FROM invoices WHERE id = ? FOR UPDATE`,
      [invoiceId],
    );
    if (!invoice) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Invoice tidak ditemukan.",
      });
    }

    const remaining =
      Number(invoice.total_amount) - Number(invoice.paid_amount);
    if (remaining <= 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: "Invoice ini sudah lunas.",
      });
    }
    if (amountPaid > remaining) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: "Jumlah pembayaran melebihi sisa tagihan.",
      });
    }

    const paymentNumber = `PAY-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const newPaidAmount = Number(invoice.paid_amount) + amountPaid;
    const nextStatus =
      newPaidAmount >= Number(invoice.total_amount) ? "paid" : "partially_paid";

    await connection.execute(
      `INSERT INTO invoice_payments (
         invoice_id, payment_number, payment_date, amount_paid,
         payment_method, verified_by, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        paymentNumber,
        paymentDate.toISOString().slice(0, 10),
        amountPaid,
        paymentMethod,
        req.admin.id,
        notes || null,
      ],
    );
    await connection.execute(
      "UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?",
      [newPaidAmount, nextStatus, invoiceId],
    );
    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Pembayaran invoice berhasil dicatat.",
      data: {
        invoice_id: invoiceId,
        payment_number: paymentNumber,
        paid_amount: newPaidAmount,
        remaining_amount: Number(invoice.total_amount) - newPaidAmount,
        status: nextStatus,
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Record invoice payment rollback error:", rollbackError);
      }
    }

    console.error("Record admin invoice payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Pembayaran invoice tidak dapat dicatat saat ini.",
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  createInvoice,
  listAvailableOrders,
  listInvoices,
  recordPayment,
};
