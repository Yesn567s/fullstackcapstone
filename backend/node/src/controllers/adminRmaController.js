const db = require("../config/db");

async function listRmaRequests(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.rma_number, r.order_id, r.delivery_id, r.customer_id,
              r.request_date, r.proof_media_url, r.claim_reason,
              r.verification_status, r.action_type, r.credit_note_amount,
              r.updated_at,
              o.order_number, o.po_number, o.status AS order_status,
              c.company_name,
              d.delivery_note_number,
              (
                SELECT cj.job_number
                FROM cutting_jobs cj
                WHERE cj.order_id = r.order_id
                  AND cj.job_number LIKE CONCAT('CJ-RMA-', r.id, '-%')
                ORDER BY cj.id DESC
                LIMIT 1
              ) AS rework_job_number,
              (
                SELECT cj.status
                FROM cutting_jobs cj
                WHERE cj.order_id = r.order_id
                  AND cj.job_number LIKE CONCAT('CJ-RMA-', r.id, '-%')
                ORDER BY cj.id DESC
                LIMIT 1
              ) AS rework_job_status
       FROM rma_requests r
       JOIN orders o ON o.id = r.order_id
       JOIN customers c ON c.id = r.customer_id
       JOIN deliveries d ON d.id = r.delivery_id
       ORDER BY FIELD(r.verification_status, 'pending', 'verified', 'rejected'),
                r.request_date DESC, r.id DESC`,
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List admin RMA error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar tiket klaim RMA tidak dapat dimuat saat ini.",
    });
  }
}

async function acknowledgeRma(req, res) {
  const rmaId = Number(req.params.id);
  if (!Number.isInteger(rmaId) || rmaId < 1) {
    return res.status(422).json({ success: false, message: "ID RMA tidak valid." });
  }

  const { action, admin_notes: adminNotes } = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[rma]] = await connection.execute(
      `SELECT r.id, r.rma_number, r.order_id, r.verification_status, r.claim_reason,
              o.order_number
       FROM rma_requests r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = ?
       LIMIT 1
       FOR UPDATE`,
      [rmaId],
    );

    if (!rma) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Tiket RMA tidak ditemukan." });
    }
    if (rma.verification_status !== "pending") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Tiket RMA ini sudah diproses sebelumnya.",
      });
    }

    const nextStatus = action === "acknowledge" ? "verified" : "rejected";
    const noteText = String(adminNotes || "").trim();
    const defaultNote =
      action === "acknowledge"
        ? "Admin menyetujui klaim. Mohon kirim balik barang yang diklaim ke pabrik untuk diproses ulang."
        : "Klaim RMA ditolak oleh Admin.";
    const updatedReason = `${rma.claim_reason}\n[Admin: ${noteText || defaultNote}]`;

    await connection.execute(
      `UPDATE rma_requests
       SET verification_status = ?, claim_reason = ?
       WHERE id = ?`,
      [nextStatus, updatedReason, rmaId],
    );

    const updatedBy = req.admin?.id || null;
    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'QC_Inspection', ?, ?)`,
      [
        rma.order_id,
        action === "acknowledge"
          ? `Klaim ${rma.rma_number} di-acknowledge Admin. Customer diminta mengirim balik barang yang diklaim.`
          : `Klaim ${rma.rma_number} ditolak Admin.`,
        updatedBy,
      ],
    );

    if (updatedBy) {
      await connection.execute(
        `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
         VALUES (?, ?, ?, 'rma_requests', ?, ?)`,
        [
          updatedBy,
          rma.order_id,
          action === "acknowledge" ? "ACKNOWLEDGE_RMA" : "REJECT_RMA",
          rmaId,
          `Admin ${action === "acknowledge" ? "meng-acknowledge" : "menolak"} klaim ${rma.rma_number}.`,
        ],
      );
    }

    await connection.commit();
    return res.json({
      success: true,
      message:
        action === "acknowledge"
          ? "Klaim RMA di-acknowledge. Customer diminta mengirim balik barang untuk diproses ulang."
          : "Klaim RMA ditolak.",
      data: {
        id: rmaId,
        rma_number: rma.rma_number,
        verification_status: nextStatus,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Acknowledge RMA rollback error:", rollbackError);
      }
    }
    console.error("Acknowledge RMA error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memproses klaim RMA.",
    });
  } finally {
    if (connection) connection.release();
  }
}

async function sendRmaToOperator(req, res) {
  const rmaId = Number(req.params.id);
  if (!Number.isInteger(rmaId) || rmaId < 1) {
    return res.status(422).json({ success: false, message: "ID RMA tidak valid." });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[rma]] = await connection.execute(
      `SELECT r.id, r.rma_number, r.order_id, r.verification_status, r.action_type,
              o.order_number
       FROM rma_requests r
       JOIN orders o ON o.id = r.order_id
       WHERE r.id = ?
       LIMIT 1
       FOR UPDATE`,
      [rmaId],
    );

    if (!rma) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Tiket RMA tidak ditemukan." });
    }
    if (rma.verification_status !== "verified") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Klaim RMA harus di-acknowledge terlebih dahulu sebelum dikirim ke Operator.",
      });
    }

    const [[existingRework]] = await connection.execute(
      `SELECT id, job_number FROM cutting_jobs
       WHERE order_id = ? AND job_number LIKE ?
       LIMIT 1`,
      [rma.order_id, `CJ-RMA-${rma.id}-%`],
    );
    if (existingRework) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Pekerjaan rework (${existingRework.job_number}) sudah dikirim ke Operator.`,
      });
    }

    const [[orderItem]] = await connection.execute(
      `SELECT oi.material_id, m.default_length_mm, m.default_width_mm
       FROM order_items oi
       LEFT JOIN materials m ON m.id = oi.material_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC
       LIMIT 1`,
      [rma.order_id],
    );

    let materialId = orderItem?.material_id || null;
    let sheetLen = orderItem?.default_length_mm || 2440;
    let sheetWid = orderItem?.default_width_mm || 1220;

    if (!materialId) {
      const [[fallbackMat]] = await connection.execute(
        "SELECT id, default_length_mm, default_width_mm FROM materials ORDER BY id ASC LIMIT 1",
      );
      if (!fallbackMat) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Data material belum tersedia untuk membuat job rework.",
        });
      }
      materialId = fallbackMat.id;
      sheetLen = fallbackMat.default_length_mm || 2440;
      sheetWid = fallbackMat.default_width_mm || 1220;
    }

    const jobNumber = `CJ-RMA-${rma.id}-${String(Date.now()).slice(-4)}`;
    const [jobRes] = await connection.execute(
      `INSERT INTO cutting_jobs (
         order_id, material_id, job_number, source_type,
         source_sheet_length, source_sheet_width,
         kerf_thickness_mm, dovetail_allowance_mm,
         yield_rate_percent, waste_rate_percent,
         operator_id, status
       ) VALUES (?, ?, ?, 'full_sheet', ?, ?, 3.00, 4.00, 0.00, 0.00, NULL, 'pending')`,
      [rma.order_id, materialId, jobNumber, sheetLen, sheetWid],
    );

    await connection.execute(
      "UPDATE orders SET status = 'in_production' WHERE id = ?",
      [rma.order_id],
    );

    const updatedBy = req.admin?.id || null;
    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Cutting', ?, ?)`,
      [
        rma.order_id,
        `Perbaikan klaim ${rma.rma_number} dikirim ke Operator (${jobNumber}).`,
        updatedBy,
      ],
    );

    if (updatedBy) {
      await connection.execute(
        `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
         VALUES (?, ?, 'RMA_REWORK', 'cutting_jobs', ?, ?)`,
        [
          updatedBy,
          rma.order_id,
          jobRes.insertId,
          `Admin mengirim perbaikan RMA ${rma.rma_number} ke Operator (${jobNumber}).`,
        ],
      );
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `Job perbaikan ${jobNumber} berhasil dikirim ke Dashboard Operator.`,
      data: {
        rma_id: rma.id,
        job_id: jobRes.insertId,
        job_number: jobNumber,
        order_id: rma.order_id,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Send RMA to operator rollback error:", rollbackError);
      }
    }
    console.error("Send RMA to operator error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengirim pekerjaan perbaikan RMA ke Operator.",
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  acknowledgeRma,
  listRmaRequests,
  sendRmaToOperator,
};
