const db = require("../config/db");

const VALID_PERIODS = new Set([
  "this-month",
  "last-month",
  "this-quarter",
  "this-year",
]);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodRange(period, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "this-month") {
    return {
      start: formatDate(new Date(year, month, 1)),
      end: formatDate(new Date(year, month + 1, 1)),
    };
  }
  if (period === "last-month") {
    return {
      start: formatDate(new Date(year, month - 1, 1)),
      end: formatDate(new Date(year, month, 1)),
    };
  }
  if (period === "this-quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: formatDate(new Date(year, quarterStartMonth, 1)),
      end: formatDate(new Date(year, quarterStartMonth + 3, 1)),
    };
  }
  return {
    start: formatDate(new Date(year, 0, 1)),
    end: formatDate(new Date(year + 1, 0, 1)),
  };
}

async function getDashboard(req, res) {
  const period = req.query.period || "this-month";
  if (!VALID_PERIODS.has(period)) {
    return res.status(422).json({
      success: false,
      message: "Periode dashboard tidak valid.",
    });
  }

  const { start, end } = getPeriodRange(period);
  const now = new Date();
  const trendStart = formatDate(
    new Date(now.getFullYear(), now.getMonth() - 5, 1),
  );
  const trendEnd = formatDate(
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  );

  try {
    const [[orders]] = await db.execute(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(status NOT IN ('completed', 'cancelled')), 0) AS active_orders,
              (SELECT COUNT(*) FROM orders
               WHERE status NOT IN ('completed', 'cancelled')) AS all_active_orders
       FROM orders
       WHERE order_date >= ? AND order_date < ?`,
      [start, end],
    );

    const [[production]] = await db.execute(
      `SELECT COUNT(*) AS job_count,
              COALESCE(AVG(NULLIF(yield_rate_percent, 0)), 0) AS average_yield,
              COALESCE(AVG(NULLIF(waste_rate_percent, 0)), 0) AS average_waste,
              COALESCE(AVG(source_type = 'offcut') * 100, 0) AS offcut_usage_percent
       FROM cutting_jobs
       WHERE created_at >= ? AND created_at < ?`,
      [start, end],
    );

    const [[receivables]] = await db.execute(
      `SELECT COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) AS active_receivables,
              COUNT(*) AS active_invoice_count
       FROM invoices
       WHERE status IN ('unpaid', 'partially_paid', 'overdue')`,
    );

    const [trend] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              ROUND(AVG(NULLIF(yield_rate_percent, 0)), 2) AS average_yield
       FROM cutting_jobs
       WHERE created_at >= ? AND created_at < ?
         AND yield_rate_percent IS NOT NULL
         AND yield_rate_percent > 0
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`,
      [trendStart, trendEnd],
    );

    const [invoices] = await db.execute(
      `SELECT i.invoice_number, c.company_name, i.due_date, i.total_amount,
              GREATEST(i.total_amount - i.paid_amount, 0) AS remaining_amount,
              CASE
                WHEN i.due_date < CURRENT_DATE() THEN 'overdue'
                ELSE i.status
              END AS status
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE i.status IN ('unpaid', 'partially_paid', 'overdue')
       ORDER BY i.due_date ASC, i.id DESC
       LIMIT 8`,
    );

    return res.json({
      success: true,
      data: {
        period: { key: period, start, end },
        kpis: {
          total_orders: Number(orders.total_orders) || 0,
          active_orders: Number(orders.active_orders) || 0,
          all_active_orders: Number(orders.all_active_orders) || 0,
          job_count: Number(production.job_count) || 0,
          average_yield: Number(production.average_yield) || 0,
          average_waste: Number(production.average_waste) || 0,
          offcut_usage_percent: Number(production.offcut_usage_percent) || 0,
          active_receivables: Number(receivables.active_receivables) || 0,
          active_invoice_count: Number(receivables.active_invoice_count) || 0,
        },
        trend,
        invoices,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Data dashboard admin tidak dapat dimuat saat ini.",
    });
  }
}

module.exports = { getDashboard };
