// src/controllers/operatorController.js
// Endpoint read-only untuk dashboard Operator.
const db = require('../config/db');

async function getSummary(req, res) {
  try {
    const staffId = req.staff.id;

    // 1. Cutting jobs assigned to this operator (pending + in_progress)
    const [jobs] = await db.execute(
      `SELECT cj.id, cj.job_number, cj.status, cj.created_at, cj.finished_at,
              o.order_number, o.id AS order_id,
              m.material_name, m.thickness_mm
       FROM cutting_jobs cj
       JOIN orders o ON cj.order_id = o.id
       JOIN materials m ON cj.material_id = m.id
       WHERE (cj.operator_id = ? OR (cj.operator_id IS NULL AND cj.status = 'pending')) AND cj.status IN ('pending', 'in_progress')
       ORDER BY cj.created_at DESC`,
      [staffId],
    );

    // 2. Deliveries hari ini (surat jalan)
    const [deliveries] = await db.execute(
      `SELECT d.id, d.delivery_note_number, d.delivery_date, d.truck_plate_number,
              d.driver_name, d.quantity_shipped, d.received_status,
              o.order_number, o.id AS order_id
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       WHERE d.delivery_date = CURDATE()
       ORDER BY d.id DESC`,
      [],
    );

    // 3. Stats sederhana
    const [completedToday] = await db.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(cj.yield_rate_percent), 0) AS total_yield
       FROM cutting_jobs cj
       WHERE cj.operator_id = ? AND cj.status = 'completed' AND DATE(cj.finished_at) = CURDATE()`,
      [staffId],
    );

    return res.json({
      success: true,
      data: {
        activeJobs: jobs,
        todaysDeliveries: deliveries,
        stats: {
          activeCount: jobs.length,
          deliveryCount: deliveries.length,
          completedToday: completedToday[0].cnt || 0,
        },
      },
    });
  } catch (error) {
    console.error('Operator summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat ringkasan operator.',
    });
  }
}

async function getJobs(req, res) {
  try {
    const staffId = req.staff.id;
    const { status } = req.query;

    let where = "(cj.operator_id = ? OR (cj.operator_id IS NULL AND cj.status = 'pending'))";
    const params = [staffId];

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      where += ' AND cj.status = ?';
      params.push(status);
    }

    const [jobs] = await db.execute(
      `SELECT cj.id, cj.job_number, cj.status, cj.source_type, cj.kerf_thickness_mm,
              cj.dovetail_allowance_mm, cj.yield_rate_percent, cj.waste_rate_percent,
              cj.created_at, cj.finished_at,
              o.order_number, o.id AS order_id,
              m.material_name, m.thickness_mm, m.default_length_mm, m.default_width_mm
       FROM cutting_jobs cj
       JOIN orders o ON cj.order_id = o.id
       JOIN materials m ON cj.material_id = m.id
       WHERE ${where}
       ORDER BY cj.created_at DESC`,
      params,
    );

    // Ambil patterns untuk tiap job
    for (const job of jobs) {
      const [patterns] = await db.execute(
        `SELECT cp.id, cp.label, cp.pos_x, cp.pos_y, cp.width_mm, cp.height_mm,
                cp.cut_step_order, cp.is_offcut_usable, ci.component_type
         FROM cutting_patterns cp
         LEFT JOIN component_items ci ON cp.component_item_id = ci.id
         WHERE cp.cutting_job_id = ?
         ORDER BY cp.cut_step_order`,
        [job.id],
      );
      job.patterns = patterns;
    }

    return res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Operator jobs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat daftar pekerjaan.',
    });
  }
}

async function getDeliveries(req, res) {
  try {
    const [deliveries] = await db.execute(
      `SELECT d.id, d.delivery_note_number, d.delivery_date, d.truck_plate_number,
              d.driver_name, d.quantity_shipped, d.received_status, d.received_date,
              o.order_number, o.id AS order_id,
              c.company_name
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       JOIN customers c ON o.customer_id = c.id
       ORDER BY d.delivery_date DESC, d.id DESC
       LIMIT 50`,
      [],
    );

    // Items per delivery
    for (const d of deliveries) {
      const [items] = await db.execute(
        `SELECT di.quantity_shipped, oi.drawer_type_code, oi.finished_length_mm,
                oi.finished_width_mm, oi.finished_height_mm
         FROM delivery_items di
         JOIN order_items oi ON di.order_item_id = oi.id
         WHERE di.delivery_id = ?`,
        [d.id],
      );
      d.items = items;
    }

    return res.json({ success: true, data: deliveries });
  } catch (error) {
    console.error('Operator deliveries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat daftar surat jalan.',
    });
  }
}

async function updateJobStatus(req, res) {
  const staffId = req.staff.id;

  if (!staffId) {
    return res.status(403).json({
      success: false,
      message: 'Gunakan akun staff terdaftar di database untuk mencatat aktivitas produksi.',
    });
  }

  const jobId = Number(req.params.id);
  const { status } = req.body;
  let connection;

  if (!Number.isInteger(jobId) || jobId < 1) {
    return res.status(422).json({ success: false, message: 'ID pekerjaan tidak valid.' });
  }
  if (!['in_progress', 'completed'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Status tidak valid.' });
  }

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[job]] = await connection.execute(
      'SELECT id, order_id, status, operator_id, job_number FROM cutting_jobs WHERE id = ? FOR UPDATE',
      [jobId],
    );

    if (!job) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pekerjaan tidak ditemukan.' });
    }
    if (job.status === 'completed') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Pekerjaan sudah selesai.' });
    }

    if (status === 'in_progress') {
      // Claim job: boleh kalau belum ada operator ATAU sudah milik sendiri.
      if (job.operator_id !== null && Number(job.operator_id) !== Number(staffId)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Pekerjaan sudah diambil operator lain.' });
      }
      await connection.execute(
        'UPDATE cutting_jobs SET status = ?, operator_id = ? WHERE id = ?',
        ['in_progress', staffId, jobId],
      );
      await connection.execute(
        `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
         VALUES (?, ?, 'START_CUTTING', 'cutting_jobs', ?, ?)`,
        [staffId, job.order_id, jobId, `Operator memulai pekerjaan ${job.job_number}.`],
      );
    } else {
      // completed: hanya operator pemilik job.
      if (job.operator_id === null || Number(job.operator_id) !== Number(staffId)) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: 'Hanya operator pemilik pekerjaan yang dapat menyelesaikannya.' });
      }
      await connection.execute(
        'UPDATE cutting_jobs SET status = ?, finished_at = NOW() WHERE id = ?',
        ['completed', jobId],
      );
      await connection.execute(
        `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
         VALUES (?, ?, 'FINISH_CUTTING', 'cutting_jobs', ?, ?)`,
        [staffId, job.order_id, jobId, `Operator menyelesaikan pekerjaan ${job.job_number}.`],
      );
    }

    // Dorong order ke in_production jika masih ready_for_production.
    const [[orderRow]] = await connection.execute(
      'SELECT status FROM orders WHERE id = ? FOR UPDATE',
      [job.order_id],
    );
    if (orderRow && orderRow.status === 'ready_for_production') {
      await connection.execute("UPDATE orders SET status = 'in_production' WHERE id = ?", [job.order_id]);
    }
    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, 'Cutting', ?, ?)`,
      [job.order_id, status === 'in_progress' ? `Pemotongan dimulai (${job.job_number}).` : `Pemotongan selesai (${job.job_number}).`, staffId],
    );

    await connection.commit();
    return res.json({ success: true, message: `Status diubah ke ${status}.` });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Update job rollback error:', rollbackError); }
    }
    console.error('Operator update job status error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status pekerjaan.' });
  } finally {
    if (connection) connection.release();
  }
}

async function getJobPatterns(req, res) {
  const jobId = Number(req.params.id);
  if (!Number.isInteger(jobId) || jobId < 1) {
    return res.status(422).json({ success: false, message: 'ID pekerjaan tidak valid.' });
  }
  try {
    const [[job]] = await db.execute(
      `SELECT cj.id, cj.job_number, cj.status, cj.source_sheet_length, cj.source_sheet_width,
              cj.kerf_thickness_mm, o.id AS order_id, o.order_number,
              m.material_name, m.thickness_mm
       FROM cutting_jobs cj
       JOIN orders o ON cj.order_id = o.id
       JOIN materials m ON cj.material_id = m.id
       WHERE cj.id = ? LIMIT 1`,
      [jobId],
    );
    if (!job) {
      return res.status(404).json({ success: false, message: 'Pekerjaan tidak ditemukan.' });
    }

    const [patterns] = await db.execute(
      `SELECT cp.id, cp.label, cp.pos_x, cp.pos_y, cp.width_mm, cp.height_mm,
              cp.cut_step_order, cp.is_offcut_usable, ci.component_type,
              oi.drawer_type_code
       FROM cutting_patterns cp
       LEFT JOIN component_items ci ON cp.component_item_id = ci.id
       LEFT JOIN order_items oi ON ci.order_item_id = oi.id
       WHERE cp.cutting_job_id = ?
       ORDER BY cp.cut_step_order ASC`,
      [jobId],
    );

    return res.json({ success: true, data: { ...job, patterns } });
  } catch (error) {
    console.error('Operator job patterns error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat pola potong.' });
  }
}

const PRODUCTION_STAGES = ['Cutting', 'Assembly', 'QC_Inspection'];

async function updateOrderStage(req, res) {
  const staffId = req.staff.id;

  if (!staffId) {
    return res.status(403).json({
      success: false,
      message: 'Gunakan akun staff terdaftar di database untuk mencatat aktivitas produksi.',
    });
  }

  const orderId = Number(req.params.id);
  const { stage, description } = req.body;
  let connection;

  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({ success: false, message: 'ID PO tidak valid.' });
  }
  if (!PRODUCTION_STAGES.includes(stage)) {
    return res.status(422).json({ success: false, message: 'Tahapan produksi tidak valid.' });
  }

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[orderRow]] = await connection.execute(
      'SELECT id, order_number, status FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );
    if (!orderRow) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });
    }

    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, status_description, updated_by)
       VALUES (?, ?, ?, ?)`,
      [orderId, stage, description || `Tahapan ${stage} dicatat operator.`, staffId],
    );
    if (orderRow.status === 'ready_for_production') {
      await connection.execute("UPDATE orders SET status = 'in_production' WHERE id = ?", [orderId]);
    }
    await connection.execute(
      `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
       VALUES (?, ?, 'UPDATE_PRODUCTION_STATUS', 'orders', ?, ?)`,
      [staffId, orderId, orderId, `Tahapan produksi ${stage} untuk PO ${orderRow.order_number}.`],
    );

    await connection.commit();
    return res.json({ success: true, message: `Tahapan ${stage} dicatat.` });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Update stage rollback error:', rollbackError); }
    }
    console.error('Operator update stage error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mencatat tahapan produksi.' });
  } finally {
    if (connection) connection.release();
  }
}

async function createOffcut(req, res) {
  const staffId = req.staff.id;

  if (!staffId) {
    return res.status(403).json({
      success: false,
      message: 'Gunakan akun staff terdaftar di database untuk mencatat aktivitas produksi.',
    });
  }

  const { material_id, customer_id, length_mm, width_mm, grain_orientation, location_tag } = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[material]] = await connection.execute(
      'SELECT id, material_name FROM materials WHERE id = ? LIMIT 1',
      [material_id],
    );
    if (!material) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'Material tidak ditemukan.' });
    }

    const [result] = await connection.execute(
      `INSERT INTO offcuts (material_id, customer_id, length_mm, width_mm, grain_orientation, status, location_tag)
       VALUES (?, ?, ?, ?, ?, 'available', ?)`,
      [material_id, customer_id || null, length_mm, width_mm, grain_orientation || 'lengthwise', location_tag || null],
    );
    const offcutId = result.insertId;

    await connection.execute(
      `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
       VALUES (?, NULL, 'INPUT_OFFCUT', 'offcuts', ?, ?)`,
      [staffId, offcutId, `Offcut ${length_mm}x${width_mm}mm (${material.material_name}) dicatat layak pakai.`],
    );

    await connection.commit();
    return res.status(201).json({ success: true, message: 'Offcut tersimpan.', data: { id: offcutId } });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Offcut rollback error:', rollbackError); }
    }
    console.error('Operator offcut error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan offcut.' });
  } finally {
    if (connection) connection.release();
  }
}

async function submitQC(req, res) {
  const staffId = req.staff.id;

  if (!staffId) {
    return res.status(403).json({
      success: false,
      message: 'Gunakan akun staff terdaftar di database untuk mencatat aktivitas produksi.',
    });
  }

  const { order_id, quantity_inspected, squareness_passed, dimension_passed, notes } = req.body;
  const overallStatus = squareness_passed && dimension_passed ? 'passed' : 'rejected';
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[orderRow]] = await connection.execute(
      'SELECT id, order_number FROM orders WHERE id = ? FOR UPDATE',
      [order_id],
    );
    if (!orderRow) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'PO tidak ditemukan.' });
    }

    const inspectionNumber = `QC-${Date.now()}-${staffId}`;
    const [result] = await connection.execute(
      `INSERT INTO qc_inspections (
         order_id, inspection_number, inspector_id, quantity_inspected,
         squareness_passed, dimension_passed, overall_status, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_id, inspectionNumber, staffId, quantity_inspected,
       squareness_passed ? 1 : 0, dimension_passed ? 1 : 0, overallStatus, notes || null],
    );
    const inspectionId = result.insertId;

    await connection.execute(
      `INSERT INTO po_tracking_logs (order_id, stage, affected_quantity, status_description, updated_by)
       VALUES (?, 'QC_Inspection', ?, ?, ?)`,
      [order_id, quantity_inspected, `QC ${overallStatus === 'passed' ? 'LULUS' : 'DITOLAK'} (${inspectionNumber}).`, staffId],
    );
    await connection.execute(
      `INSERT INTO activity_logs (user_id, order_id, action_type, module_name, reference_id, description)
       VALUES (?, ?, 'SUBMIT_QC', 'qc_inspections', ?, ?)`,
      [staffId, order_id, inspectionId, `QC ${inspectionNumber}: ${overallStatus} untuk PO ${orderRow.order_number}.`],
    );

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `QC ${overallStatus === 'passed' ? 'lulus' : 'ditolak'}.`,
      data: { id: inspectionId, inspection_number: inspectionNumber, overall_status: overallStatus },
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('QC rollback error:', rollbackError); }
    }
    console.error('Operator QC error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan hasil QC.' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSummary,
  getJobs,
  getDeliveries,
  updateJobStatus,
  getJobPatterns,
  updateOrderStage,
  createOffcut,
  submitQC,
};