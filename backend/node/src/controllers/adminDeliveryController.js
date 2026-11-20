const db = require("../config/db");

const SHIPPABLE_ORDER_STATUSES = [
  "ready_for_production",
  "in_production",
  "partially_shipped",
];

async function listDeliveries(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT d.id, d.delivery_note_number, d.delivery_date,
              d.truck_plate_number, d.driver_name, d.quantity_shipped,
              d.received_status, d.received_date,
              o.order_number, o.po_number, c.company_name
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN customers c ON c.id = o.customer_id
       ORDER BY d.delivery_date DESC, d.id DESC`,
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List admin deliveries error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar surat jalan tidak dapat dimuat saat ini.",
    });
  }
}

async function listShippableOrders(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, c.company_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.status IN (?, ?, ?)
         AND EXISTS (
           SELECT 1 FROM qc_inspections qi
           WHERE qi.id = (
             SELECT latest_qi.id FROM qc_inspections latest_qi
             WHERE latest_qi.order_id = o.id
             ORDER BY latest_qi.inspection_date DESC, latest_qi.id DESC
             LIMIT 1
           )
             AND qi.overall_status = 'passed'
         )
         AND EXISTS (
           SELECT 1 FROM order_items oi
           WHERE oi.order_id = o.id
             AND oi.quantity > COALESCE((
               SELECT SUM(di.quantity_shipped)
               FROM delivery_items di
               WHERE di.order_item_id = oi.id
             ), 0)
         )
       ORDER BY o.order_date DESC, o.id DESC`,
      SHIPPABLE_ORDER_STATUSES,
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List shippable orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Daftar PO siap kirim tidak dapat dimuat saat ini.",
    });
  }
}

async function getOrderForDelivery(req, res) {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(422).json({
      success: false,
      message: "ID PO tidak valid.",
    });
  }

  try {
    const [[order]] = await db.execute(
      `SELECT o.id, o.order_number, o.po_number, o.status, c.company_name
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

    if (!SHIPPABLE_ORDER_STATUSES.includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "Status PO belum mengizinkan pengiriman.",
      });
    }

    const [[inspection]] = await db.execute(
      `SELECT id, overall_status FROM qc_inspections
       WHERE order_id = ?
       ORDER BY inspection_date DESC, id DESC
       LIMIT 1`,
      [orderId],
    );
    if (!inspection || inspection.overall_status !== "passed") {
      return res.status(409).json({
        success: false,
        message: "PO harus memiliki hasil QC lulus sebelum dikirim.",
      });
    }

    const [items] = await db.execute(
      `SELECT oi.id, oi.drawer_type_code, oi.quantity,
              COALESCE(SUM(di.quantity_shipped), 0) AS shipped_quantity,
              oi.quantity - COALESCE(SUM(di.quantity_shipped), 0) AS remaining_quantity
       FROM order_items oi
       LEFT JOIN delivery_items di ON di.order_item_id = oi.id
       WHERE oi.order_id = ?
       GROUP BY oi.id, oi.drawer_type_code, oi.quantity
       HAVING remaining_quantity > 0
       ORDER BY oi.id`,
      [orderId],
    );

    return res.json({
      success: true,
      data: {
        ...order,
        qc_inspection_id: inspection.id,
        items,
      },
    });
  } catch (error) {
    console.error("Get order for delivery error:", error);
    return res.status(500).json({
      success: false,
      message: "Detail PO untuk surat jalan tidak dapat dimuat.",
    });
  }
}

async function getDeliveryDetails(req, res) {
  const deliveryId = Number(req.params.id);
  if (!Number.isInteger(deliveryId) || deliveryId < 1) {
    return res.status(422).json({
      success: false,
      message: "ID surat jalan tidak valid.",
    });
  }

  try {
    const [[delivery]] = await db.execute(
      `SELECT d.id, d.order_id, d.qc_inspection_id, d.delivery_note_number,
              d.delivery_date, d.truck_plate_number, d.driver_name,
              d.quantity_shipped, d.received_status, d.received_date,
              o.order_number, o.po_number, c.company_name,
              qi.inspection_number
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN customers c ON c.id = o.customer_id
       JOIN qc_inspections qi ON qi.id = d.qc_inspection_id
       WHERE d.id = ?
       LIMIT 1`,
      [deliveryId],
    );
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Surat jalan tidak ditemukan.",
      });
    }

    const [items] = await db.execute(
      `SELECT oi.id AS order_item_id, oi.drawer_type_code,
              di.quantity_shipped, oi.finished_length_mm,
              oi.finished_width_mm, oi.finished_height_mm
       FROM delivery_items di
       JOIN order_items oi ON oi.id = di.order_item_id
       WHERE di.delivery_id = ?
       ORDER BY oi.id`,
      [deliveryId],
    );

    return res.json({ success: true, data: { ...delivery, items } });
  } catch (error) {
    console.error("Get admin delivery details error:", error);
    return res.status(500).json({
      success: false,
      message: "Detail surat jalan tidak dapat dimuat saat ini.",
    });
  }
}

async function createDelivery(req, res) {
  const {
    order_id: orderId,
    delivery_note_number: deliveryNumber,
    delivery_date: deliveryDate,
    truck_plate_number: truckPlate,
    driver_name: driverName,
    items,
  } = req.body;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[order]] = await connection.execute(
      "SELECT id, order_number, status FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "PO tidak ditemukan.",
      });
    }
    if (!SHIPPABLE_ORDER_STATUSES.includes(order.status)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Status PO belum mengizinkan pengiriman.",
      });
    }

    const [[inspection]] = await connection.execute(
      `SELECT id, overall_status FROM qc_inspections
       WHERE order_id = ?
       ORDER BY inspection_date DESC, id DESC
       LIMIT 1`,
      [orderId],
    );
    if (!inspection || inspection.overall_status !== "passed") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "PO harus memiliki hasil QC lulus sebelum dikirim.",
      });
    }

    const [orderItems] = await connection.execute(
      `SELECT oi.id, oi.quantity,
              COALESCE(SUM(di.quantity_shipped), 0) AS shipped_quantity
       FROM order_items oi
       LEFT JOIN delivery_items di ON di.order_item_id = oi.id
       WHERE oi.order_id = ?
       GROUP BY oi.id, oi.quantity
       ORDER BY oi.id`,
      [orderId],
    );
    if (!orderItems.length) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "PO belum memiliki item yang dapat dikirim.",
      });
    }

    const orderItemById = new Map(
      orderItems.map((item) => [Number(item.id), item]),
    );
    const requestedItems = items.map((item) => ({
      orderItemId: item.order_item_id,
      quantity: item.quantity_shipped,
    }));

    for (const item of requestedItems) {
      const orderItem = orderItemById.get(item.orderItemId);
      if (!orderItem) {
        await connection.rollback();
        return res.status(422).json({
          success: false,
          message: "Item surat jalan tidak sesuai dengan PO yang dipilih.",
        });
      }

      const remaining =
        Number(orderItem.quantity) - Number(orderItem.shipped_quantity);
      if (item.quantity > remaining) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `Jumlah kirim melebihi sisa item ${item.orderItemId} (${remaining}).`,
        });
      }
    }

    const totalQuantity = requestedItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    const [deliveryResult] = await connection.execute(
      `INSERT INTO deliveries (
         order_id, qc_inspection_id, delivery_note_number, delivery_date,
         truck_plate_number, driver_name, quantity_shipped
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        inspection.id,
        deliveryNumber,
        deliveryDate.toISOString().slice(0, 10),
        truckPlate,
        driverName || null,
        totalQuantity,
      ],
    );
    const deliveryId = deliveryResult.insertId;

    for (const item of requestedItems) {
      await connection.execute(
        `INSERT INTO delivery_items (delivery_id, order_item_id, quantity_shipped)
         VALUES (?, ?, ?)`,
        [deliveryId, item.orderItemId, item.quantity],
      );
    }

    const requestedByItem = new Map(
      requestedItems.map((item) => [item.orderItemId, item.quantity]),
    );
    const fullyShipped = orderItems.every((item) => {
      const shipped =
        Number(item.shipped_quantity) +
        (requestedByItem.get(Number(item.id)) || 0);
      return shipped >= Number(item.quantity);
    });
    const nextOrderStatus = fullyShipped ? "completed" : "partially_shipped";

    await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [
      nextOrderStatus,
      orderId,
    ]);

    const updatedBy = req.user.userId || null;
    await connection.execute(
      `INSERT INTO po_tracking_logs (
         order_id, stage, affected_quantity, status_description, updated_by
       ) VALUES (?, 'Shipping', ?, ?, ?)`,
      [
        orderId,
        totalQuantity,
        `Surat jalan ${deliveryNumber} dibuat.`,
        updatedBy,
      ],
    );
    if (fullyShipped) {
      await connection.execute(
        `INSERT INTO po_tracking_logs (
           order_id, stage, affected_quantity, status_description, updated_by
         ) VALUES (?, 'Completed', ?, ?, ?)`,
        [
          orderId,
          totalQuantity,
          `Seluruh item PO ${order.order_number} telah dikirim.`,
          updatedBy,
        ],
      );
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: "Surat jalan berhasil dibuat.",
      data: {
        id: deliveryId,
        delivery_note_number: deliveryNumber,
        order_id: orderId,
        quantity_shipped: totalQuantity,
        received_status: false,
        order_status: nextOrderStatus,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Create delivery rollback error:", rollbackError);
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Nomor surat jalan sudah digunakan.",
      });
    }

    console.error("Create admin delivery error:", error);
    return res.status(500).json({
      success: false,
      message: "Surat jalan tidak dapat dibuat saat ini.",
    });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  createDelivery,
  getDeliveryDetails,
  getOrderForDelivery,
  listDeliveries,
  listShippableOrders,
};
