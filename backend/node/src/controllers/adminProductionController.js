const db = require("../config/db");

async function listProductionJobs(req, res) {
  try {
    const [jobs] = await db.execute(
      `SELECT cj.id, cj.job_number, cj.status, cj.source_type, cj.created_at,
              cj.finished_at, cj.yield_rate_percent, cj.waste_rate_percent,
              o.id AS order_id, o.order_number, o.po_number,
              m.material_name, m.thickness_mm, m.default_length_mm,
              m.default_width_mm,
              COALESCE((
                SELECT SUM(oi.quantity)
                FROM order_items oi
                WHERE oi.order_id = o.id
              ), 0) AS total_order_units,
              COALESCE(u.username, 'Belum ditugaskan') AS operator_name,
              (
                SELECT al.description
                FROM activity_logs al
                WHERE al.module_name = 'cutting_jobs'
                  AND al.reference_id = cj.id
                ORDER BY al.created_at DESC, al.id DESC
                LIMIT 1
              ) AS production_note
       FROM cutting_jobs cj
       JOIN orders o ON o.id = cj.order_id
       JOIN materials m ON m.id = cj.material_id
       LEFT JOIN users u ON u.id = cj.operator_id
       ORDER BY FIELD(cj.status, 'in_progress', 'pending', 'completed'),
                cj.created_at DESC, cj.id DESC`,
    );
    const [[summary]] = await db.execute(
      `SELECT
         (SELECT COUNT(DISTINCT order_id)
          FROM cutting_jobs
          WHERE status IN ('pending', 'in_progress')) AS active_orders,
         (SELECT COUNT(*)
          FROM cutting_jobs
          WHERE status IN ('pending', 'in_progress')) AS active_jobs,
         (SELECT COALESCE(SUM(quantity_inspected), 0)
          FROM qc_inspections
          WHERE overall_status = 'passed') AS passed_qc_units`,
    );

    return res.json({ success: true, data: jobs, summary });
  } catch (error) {
    console.error("List production monitoring jobs error:", error);
    return res.status(500).json({
      success: false,
      message: "Data monitoring produksi tidak dapat dimuat saat ini.",
    });
  }
}

module.exports = { listProductionJobs };
