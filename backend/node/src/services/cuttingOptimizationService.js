// src/services/cuttingOptimizationService.js
// Engine Optimasi Pemotongan 2D (Guillotine Bin Packing) - CV. Sumber Artha.
// Port dari backend/php/cutting-optimization.php ke stack Node/Express.
//
// Fitur:
// - Multi-Item Batch Nesting (gabung beberapa ukuran komponen dalam 1 PO per material)
// - Kerf 3 mm pada setiap garis potong
// - Grain constraint (rotasi 90 derajat hanya jika grain_orientation = 'any')
// - Prioritas pemakaian offcut internal sebelum lembaran utuh
// - Output koordinat (pos_x, pos_y, width_mm, height_mm, cut_step_order)
//   siap dirender ke HTML5 Canvas dan disimpan ke cutting_patterns.
//
// Algoritma: shelf-based First-Fit Decreasing guillotine. Setiap batas shelf
// adalah potongan lurus end-to-end, sehingga 100% memenuhi guillotine constraint.

const KERF_MM = 3.0;
const DOVETAIL_MM = 4.0;

async function loadOrderComponents(connection, orderId) {
  const [rows] = await connection.execute(
    `SELECT ci.id, ci.component_type, ci.raw_length_mm, ci.raw_width_mm,
            ci.grain_orientation, ci.quantity,
            m.id AS material_id, m.material_name,
            m.default_length_mm, m.default_width_mm
     FROM component_items ci
     JOIN order_items oi ON oi.id = ci.order_item_id
     JOIN materials m ON m.id = ci.material_id
     WHERE oi.order_id = ?`,
    [orderId],
  );
  return rows;
}

function groupByMaterial(components) {
  const groups = new Map();
  for (const component of components) {
    const key = component.material_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(component);
  }
  return [...groups.values()];
}

function expandPieces(components) {
  const pieces = [];
  for (const component of components) {
    const quantity = Number(component.quantity);
    for (let i = 0; i < quantity; i++) {
      pieces.push({
        component_item_id: component.id,
        label: `${component.component_type} #${i + 1}`,
        w: Number(component.raw_length_mm),
        h: Number(component.raw_width_mm),
        grain: component.grain_orientation,
      });
    }
  }
  // First-Fit Decreasing: urut area terbesar dulu.
  pieces.sort((a, b) => b.w * b.h - a.w * a.h);
  return pieces;
}

async function loadAvailableOffcuts(connection, materialId, customerId) {
  const [rows] = await connection.execute(
    `SELECT id, length_mm, width_mm FROM offcuts
     WHERE material_id = ? AND status = 'available'
       AND (customer_id = ? OR customer_id IS NULL)
     ORDER BY length_mm * width_mm DESC
     FOR UPDATE`,
    [materialId, customerId],
  );
  return rows;
}

// Shelf-based FFD guillotine packing ke satu lembar.
// Setiap shelf adalah pita horizontal penuh; piece dalam shelf dipisah
// potongan vertikal penuh -> guillotine-safe.
function packSheet(pieces, sheetLength, sheetWidth) {
  const placed = [];
  const remaining = [];
  const EPS = 1e-9;

  let y = 0.0; // kursor vertikal shelf saat ini
  let shelfH = 0.0; // tinggi shelf saat ini
  let x = 0.0; // kursor horizontal dalam shelf
  let sheetStarted = false;

  for (const piece of pieces) {
    const orientations = [{ w: piece.w, h: piece.h }];
    if (piece.grain === 'any' && piece.w !== piece.h) {
      orientations.push({ w: piece.h, h: piece.w });
    }

    let didPlace = false;
    for (const orientation of orientations) {
      const { w, h } = orientation;

      // Coba muat di shelf saat ini.
      if (sheetStarted && x + w <= sheetLength + EPS && y + h <= sheetWidth + EPS) {
        placed.push(makePlacement(piece, x, y, w, h));
        x += w + KERF_MM;
        shelfH = Math.max(shelfH, h);
        didPlace = true;
        break;
      }

      // Buka shelf baru di bawah (satu potongan horizontal end-to-end).
      if (sheetStarted && y + shelfH + KERF_MM + h <= sheetWidth + EPS) {
        y += shelfH + KERF_MM;
        shelfH = h;
        x = w + KERF_MM;
        placed.push(makePlacement(piece, 0.0, y, w, h));
        didPlace = true;
        break;
      }

      // Lembar masih kosong: mulai dari (0,0).
      if (!sheetStarted && w <= sheetLength + EPS && h <= sheetWidth + EPS) {
        sheetStarted = true;
        x = w + KERF_MM;
        shelfH = h;
        placed.push(makePlacement(piece, 0.0, 0.0, w, h));
        didPlace = true;
        break;
      }
    }

    if (!didPlace) {
      remaining.push(piece);
    }
  }

  // Tandai zona sisa lembar sebagai kandidat offcut jika cukup besar (>= 100 mm).
  if (placed.length > 0 && sheetWidth - (y + shelfH) >= 100.0) {
    placed[0].offcut_usable = true;
  }

  return { placed, remaining };
}

function makePlacement(piece, x, y, w, h) {
  return {
    ...piece,
    x,
    y,
    w,
    h,
    offcut_usable: false,
  };
}

async function persistCuttingJob(
  connection,
  orderId,
  orderNumber,
  materialId,
  operatorId,
  sheet,
  index,
) {
  const jobNumber = `CJ-${orderNumber}-${String(index + 1).padStart(3, '0')}`;

  const [jobResult] = await connection.execute(
    `INSERT INTO cutting_jobs
        (order_id, job_number, material_id, source_type, source_sheet_length,
         source_sheet_width, used_offcut_id, kerf_thickness_mm,
         dovetail_allowance_mm, yield_rate_percent, waste_rate_percent,
         status, operator_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?)`,
    [
      orderId,
      jobNumber,
      materialId,
      sheet.source_type,
      sheet.length,
      sheet.width,
      sheet.offcut_id,
      KERF_MM,
      DOVETAIL_MM,
      operatorId,
    ],
  );
  const jobId = jobResult.insertId;

  let usedArea = 0.0;
  const canvasPieces = [];

  for (let step = 0; step < sheet.placed.length; step++) {
    const placement = sheet.placed[step];
    await connection.execute(
      `INSERT INTO cutting_patterns
          (cutting_job_id, component_item_id, label, pos_x, pos_y,
           width_mm, height_mm, cut_step_order, is_offcut_usable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        placement.component_item_id,
        placement.label,
        Math.round(placement.x * 100) / 100,
        Math.round(placement.y * 100) / 100,
        Math.round(placement.w * 100) / 100,
        Math.round(placement.h * 100) / 100,
        step + 1,
        placement.offcut_usable ? 1 : 0,
      ],
    );

    usedArea += placement.w * placement.h;
    canvasPieces.push({
      component_item_id: placement.component_item_id,
      label: placement.label,
      pos_x: Math.round(placement.x),
      pos_y: Math.round(placement.y),
      width_mm: Math.round(placement.w),
      height_mm: Math.round(placement.h),
      cut_step_order: step + 1,
    });
  }

  const totalArea = sheet.length * sheet.width;
  const yieldRate = Math.round((usedArea / totalArea) * 100 * 100) / 100;
  const wasteRate = Math.round((100 - yieldRate) * 100) / 100;

  await connection.execute(
    'UPDATE cutting_jobs SET yield_rate_percent = ?, waste_rate_percent = ? WHERE id = ?',
    [yieldRate, wasteRate, jobId],
  );

  if (sheet.offcut_id !== null) {
    await connection.execute("UPDATE offcuts SET status = 'used' WHERE id = ?", [
      sheet.offcut_id,
    ]);
  }

  return {
    job_number: jobNumber,
    source_type: sheet.source_type,
    sheet: { length: sheet.length, width: sheet.width },
    yield_rate_percent: yieldRate,
    waste_rate_percent: wasteRate,
    pieces: canvasPieces,
  };
}

async function resolveFallbackMaterialId(connection, customerId) {
  const [[customerOrShared]] = await connection.execute(
    `SELECT id FROM materials
     WHERE customer_id = ? OR customer_id IS NULL
     ORDER BY (customer_id = ?) DESC, id ASC LIMIT 1`,
    [customerId, customerId],
  );
  if (customerOrShared) return customerOrShared.id;

  const [[anyMaterial]] = await connection.execute(
    'SELECT id FROM materials ORDER BY id ASC LIMIT 1',
  );
  if (anyMaterial) return anyMaterial.id;

  await connection.execute(
    `INSERT IGNORE INTO materials (
       customer_id, material_code, material_name, thickness_mm,
       default_length_mm, default_width_mm, stock_sheets, has_grain_constraint
     ) VALUES (NULL, 'STD-LVB-12', 'LVB Standar (1220x2440 mm)', 12.00, 2440.00, 1220.00, 100, TRUE)`,
  );
  const [[created]] = await connection.execute(
    "SELECT id FROM materials WHERE material_code = 'STD-LVB-12' LIMIT 1",
  );
  return created ? created.id : null;
}

/**
 * Auto-breakdown order_items -> component_items (+4 mm dovetail) jika belum ada,
 * agar PO baru langsung siap dijalankan oleh Engine Optimasi 2D (/api/cutting/optimize).
 */
async function ensureOrderComponents(connection, orderId, customerId) {
  const [items] = await connection.execute(
    `SELECT id, material_id, finished_length_mm, finished_width_mm, finished_height_mm, quantity
     FROM order_items WHERE order_id = ?`,
    [orderId],
  );
  if (!items.length) return;

  let fallbackMaterialId;
  for (const it of items) {
    const [[existing]] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM component_items WHERE order_item_id = ?',
      [it.id],
    );
    if (Number(existing.cnt) > 0) continue;

    let materialId = it.material_id;
    if (!materialId) {
      if (fallbackMaterialId === undefined) {
        fallbackMaterialId = await resolveFallbackMaterialId(connection, customerId);
      }
      materialId = fallbackMaterialId;
    }
    if (!materialId) continue;

    const L = Number(it.finished_length_mm);
    const W = Number(it.finished_width_mm);
    const H = Number(it.finished_height_mm);
    const qty = Number(it.quantity);

    const panels = [
      ['front', W + DOVETAIL_MM, H, 'lengthwise', qty],
      ['back', W + DOVETAIL_MM, H, 'lengthwise', qty],
      ['side_left', L + DOVETAIL_MM, H, 'lengthwise', qty],
      ['side_right', L + DOVETAIL_MM, H, 'lengthwise', qty],
      ['bottom', L, W, 'any', qty],
    ];

    for (const [type, rawLen, rawWid, grain, pQty] of panels) {
      await connection.execute(
        `INSERT INTO component_items (
           order_item_id, component_type, material_id,
           raw_length_mm, raw_width_mm, grain_orientation, quantity
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [it.id, type, materialId, rawLen, rawWid, grain, pQty],
      );
    }
  }
}

/**
 * Jalankan optimasi untuk 1 order. Mengembalikan ringkasan cutting jobs
 * beserta pola potong JSON-ready untuk Canvas.
 */
async function optimizeOrder(pool, orderId, operatorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let components = await loadOrderComponents(connection, orderId);
    let order = null;

    if (components.length === 0) {
      const [[foundOrder]] = await connection.execute(
        'SELECT order_number, customer_id FROM orders WHERE id = ? LIMIT 1',
        [orderId],
      );
      if (!foundOrder) {
        throw Object.assign(new Error('Order tidak ditemukan.'), { statusCode: 404 });
      }
      order = foundOrder;

      await ensureOrderComponents(connection, orderId, order.customer_id);
      components = await loadOrderComponents(connection, orderId);

      if (components.length === 0) {
        throw Object.assign(
          new Error('Order tidak memiliki component_items untuk dioptimasi.'),
          { statusCode: 422 },
        );
      }
    } else {
      const [[foundOrder]] = await connection.execute(
        'SELECT order_number, customer_id FROM orders WHERE id = ? LIMIT 1',
        [orderId],
      );
      if (!foundOrder) {
        throw Object.assign(new Error('Order tidak ditemukan.'), { statusCode: 404 });
      }
      order = foundOrder;
    }

    const [[existingJob]] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM cutting_jobs WHERE order_id = ?',
      [orderId],
    );
    if (Number(existingJob.cnt) > 0) {
      throw Object.assign(
        new Error('Order ini sudah memiliki cutting job yang digenerate.'),
        { statusCode: 409 },
      );
    }

    const sheetsByMaterial = [];
    for (const group of groupByMaterial(components)) {
      const materialId = group[0].material_id;
      let pieces = expandPieces(group);

      // FASE 1: offcut internal tersedia dipakai dulu (offcut-first priority).
      const sheets = [];
      const offcuts = await loadAvailableOffcuts(
        connection,
        materialId,
        order.customer_id,
      );
      for (const offcut of offcuts) {
        const packed = packSheet(
          pieces,
          Number(offcut.length_mm),
          Number(offcut.width_mm),
        );
        if (packed.placed.length > 0) {
          pieces = packed.remaining;
          sheets.push({
            source_type: 'offcut',
            length: Number(offcut.length_mm),
            width: Number(offcut.width_mm),
            offcut_id: offcut.id,
            placed: packed.placed,
          });
        }
        if (pieces.length === 0) break;
      }

      // FASE 2: sisa piece di-pack ke lembaran utuh 2440 x 1220.
      const sheetLength = Number(group[0].default_length_mm);
      const sheetWidth = Number(group[0].default_width_mm);
      let batch = 0;
      while (pieces.length > 0 && batch < 500) {
        const packed = packSheet(pieces, sheetLength, sheetWidth);
        if (packed.placed.length === 0) {
          throw Object.assign(
            new Error(
              `Terdapat komponen yang tidak muat pada lembaran ${sheetLength} x ${sheetWidth} mm.`,
            ),
            { statusCode: 422 },
          );
        }
        pieces = packed.remaining;
        sheets.push({
          source_type: 'full_sheet',
          length: sheetLength,
          width: sheetWidth,
          offcut_id: null,
          placed: packed.placed,
        });
        batch++;
      }
      if (pieces.length > 0) {
        throw Object.assign(
          new Error('Stok material tidak mencukupi untuk order ini.'),
          { statusCode: 422 },
        );
      }

      sheetsByMaterial.push({ materialId, sheets });
    }

    // Persist semua cutting jobs + patterns dalam transaksi yang sama.
    const jobs = [];
    let jobIndex = 0;
    for (const { materialId, sheets } of sheetsByMaterial) {
      for (const sheet of sheets) {
        jobs.push(
          await persistCuttingJob(
            connection,
            orderId,
            order.order_number,
            materialId,
            operatorId,
            sheet,
            jobIndex++,
          ),
        );
      }
    }

    await connection.commit();
    return { order_id: orderId, total_sheets: jobs.length, jobs };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Cutting optimization rollback error:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Pemecahan panel otomatis (drawer-to-panel breakdown) per unit laci.
 * Front/Back: 2 pcs (width + dovetail x height), Side L/R: 2 pcs
 * (length + dovetail x height), Bottom opsional (length x width).
 */
function breakdownDrawerPanels(items, applyDovetail, includeBottom) {
  const pieces = [];
  const summary = [];
  const dovetail = applyDovetail ? DOVETAIL_MM : 0;

  for (const item of items) {
    const drawerName = String(item.drawer_name).trim();
    const quantity = Number(item.quantity);
    const grain = item.grain_orientation || 'lengthwise';
    let panelCount = 0;
    let totalArea = 0;

    for (let unit = 1; unit <= quantity; unit++) {
      const push = (label, w, h) => {
        pieces.push({
          component_item_id: null,
          drawer_name: drawerName,
          label,
          w,
          h,
          grain,
        });
        panelCount++;
        totalArea += w * h;
      };

      // Front & Back (2 pcs per laci)
      push(`${drawerName} - Front/Back #${unit}`, Number(item.width_mm) + dovetail, Number(item.height_mm));
      push(`${drawerName} - Front/Back #${unit}`, Number(item.width_mm) + dovetail, Number(item.height_mm));

      // Side Left & Side Right (2 pcs per laci)
      push(`${drawerName} - Side #${unit}`, Number(item.length_mm) + dovetail, Number(item.height_mm));
      push(`${drawerName} - Side #${unit}`, Number(item.length_mm) + dovetail, Number(item.height_mm));

      // Bottom (1 pc per laci, opsional)
      if (includeBottom) {
        push(`${drawerName} - Bottom #${unit}`, Number(item.length_mm), Number(item.width_mm));
      }
    }

    summary.push({
      drawer_name: drawerName,
      quantity,
      panel_count: panelCount,
      total_area_mm2: Math.round(totalArea * 100) / 100,
    });
  }

  return { pieces, summary };
}

/**
 * Simulasi mandiri multi-laci TANPA menyimpan ke database
 * (cutting_jobs.order_id NOT NULL, jadi murni komputasi).
 * Output format identik dengan optimizeOrder() agar renderer Canvas
 * frontend dapat dipakai ulang tanpa duplikasi.
 */
function simulateCustomCutting(payload) {
  const sheetLength = Number(payload.sheet_length_mm) || 2440;
  const sheetWidth = Number(payload.sheet_width_mm) || 1220;
  const applyDovetail = payload.apply_dovetail !== false;
  const includeBottom = payload.include_bottom === true;
  const items = payload.items;

  const { pieces, summary } = breakdownDrawerPanels(items, applyDovetail, includeBottom);

  // Multi-Item Batch Nesting: pool semua panel, urut luas terbesar dulu.
  pieces.sort((a, b) => b.w * b.h - a.w * a.h);

  const jobs = [];
  let remaining = pieces;
  let batch = 0;
  while (remaining.length > 0 && batch < 500) {
    const packed = packSheet(remaining, sheetLength, sheetWidth);
    if (packed.placed.length === 0) {
      const stuck = remaining[0];
      throw Object.assign(
        new Error(
          `Panel "${stuck.label}" (${stuck.w} x ${stuck.h} mm) tidak muat pada lembaran ${sheetLength} x ${sheetWidth} mm.`,
        ),
        { statusCode: 422 },
      );
    }
    remaining = packed.remaining;
    batch++;

    let usedArea = 0.0;
    const canvasPieces = packed.placed.map((placement, step) => {
      usedArea += placement.w * placement.h;
      return {
        component_item_id: placement.component_item_id,
        drawer_name: placement.drawer_name,
        label: placement.label,
        pos_x: Math.round(placement.x),
        pos_y: Math.round(placement.y),
        width_mm: Math.round(placement.w),
        height_mm: Math.round(placement.h),
        cut_step_order: step + 1,
      };
    });

    const totalArea = sheetLength * sheetWidth;
    const yieldRate = Math.round((usedArea / totalArea) * 100 * 100) / 100;
    const wasteRate = Math.round((100 - yieldRate) * 100) / 100;

    jobs.push({
      job_number: `SIM-${String(batch).padStart(3, '0')}`,
      source_type: 'simulation',
      sheet: { length: sheetLength, width: sheetWidth },
      yield_rate_percent: yieldRate,
      waste_rate_percent: wasteRate,
      pieces: canvasPieces,
    });
  }

  return {
    total_sheets: jobs.length,
    summary_by_drawer: summary,
    jobs,
  };
}

module.exports = {
  ensureOrderComponents,
  optimizeOrder,
  packSheet,
  simulateCustomCutting,
  KERF_MM,
  DOVETAIL_MM,
};
