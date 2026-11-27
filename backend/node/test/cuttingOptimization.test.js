// test/cuttingOptimization.test.js
// Self-check packSheet (tanpa DB) - port dari backend/php/check-cutting.php.
const { packSheet } = require('../src/services/cuttingOptimizationService');

describe('cuttingOptimizationService.packSheet', () => {
  test('multi-item nesting: 2 piece muat 1 lembar dengan kerf', () => {
    const pieces = [
      { component_item_id: 1, label: 'back #1', w: 600, h: 400, grain: 'any' },
      { component_item_id: 2, label: 'bottom #1', w: 500, h: 300, grain: 'any' },
    ];
    const packed = packSheet(pieces, 2440, 1220);
    expect(packed.placed).toHaveLength(2);
    expect(packed.remaining).toHaveLength(0);
    expect(packed.placed[1].x).toBeCloseTo(603, 5); // 600 + kerf 3
  });

  test('grain lengthwise: piece 1300x1300 tidak boleh dirotasi -> gagal muat', () => {
    const pieces = [
      { component_item_id: 1, label: 'side #1', w: 1300, h: 1300, grain: 'lengthwise' },
    ];
    const packed = packSheet(pieces, 2440, 1220);
    expect(packed.remaining).toHaveLength(1);
  });

  test('grain any: rotasi 90 derajat diizinkan', () => {
    const pieces = [
      { component_item_id: 1, label: 'side #1', w: 1300, h: 200, grain: 'any' },
    ];
    const packed = packSheet(pieces, 2440, 1220);
    expect(packed.placed).toHaveLength(1);
  });

  test('3 piece 1200x600: 2 di shelf 1, 1 turun ke shelf 2 (y = 603)', () => {
    const mk = (id) => ({ component_item_id: id, label: `p${id}`, w: 1200, h: 600, grain: 'any' });
    const packed = packSheet([mk(1), mk(2), mk(3)], 2440, 1220);
    expect(packed.placed).toHaveLength(3);
    expect(packed.placed[2].y).toBeCloseTo(603, 5); // 600 + kerf 3
  });

  test('zona sisa >= 100 mm ditandai offcut_usable', () => {
    const pieces = [
      { component_item_id: 1, label: 'a', w: 2440, h: 600, grain: 'any' },
    ];
    const packed = packSheet(pieces, 2440, 1220);
    expect(packed.placed[0].offcut_usable).toBe(true);
  });

  test('zona sisa < 100 mm tidak ditandai offcut_usable', () => {
    const pieces = [
      { component_item_id: 1, label: 'a', w: 1200, h: 600, grain: 'any' },
      { component_item_id: 2, label: 'b', w: 1200, h: 600, grain: 'any' },
      { component_item_id: 3, label: 'c', w: 1200, h: 600, grain: 'any' },
    ];
    const packed = packSheet(pieces, 2440, 1220);
    expect(packed.placed[0].offcut_usable).toBe(false);
  });
});

describe('cuttingOptimizationService.simulateCustomCutting', () => {
  const { simulateCustomCutting, DOVETAIL_MM } = require('../src/services/cuttingOptimizationService');

  test('breakdown panel: 1 laci tanpa bottom = 4 panel, dovetail +4 mm pada dinding', () => {
    const result = simulateCustomCutting({
      items: [{ drawer_name: 'Laci A', length_mm: 500, width_mm: 400, height_mm: 150, quantity: 1, grain_orientation: 'lengthwise' }],
      apply_dovetail: true,
      include_bottom: false,
    });

    expect(result.total_sheets).toBe(1);
    expect(result.jobs[0].job_number).toBe('SIM-001');
    expect(result.jobs[0].source_type).toBe('simulation');
    expect(result.summary_by_drawer[0].panel_count).toBe(4);

    const labels = result.jobs[0].pieces.map((p) => p.label);
    expect(labels.filter((l) => l.includes('Front/Back'))).toHaveLength(2);
    expect(labels.filter((l) => l.includes('Side'))).toHaveLength(2);
    expect(labels.filter((l) => l.includes('Bottom'))).toHaveLength(0);

    // Front/Back: width 400 + dovetail 4 = 404
    const front = result.jobs[0].pieces.find((p) => p.label.includes('Front/Back'));
    expect(front.width_mm).toBe(400 + DOVETAIL_MM);
    // Side: length 500 + dovetail 4 = 504
    const side = result.jobs[0].pieces.find((p) => p.label.includes('Side'));
    expect(side.width_mm).toBe(500 + DOVETAIL_MM);
  });

  test('multi-item nesting: 2 tipe laci digabung dalam pool yang sama', () => {
    const result = simulateCustomCutting({
      items: [
        { drawer_name: 'Besar', length_mm: 500, width_mm: 400, height_mm: 150, quantity: 10, grain_orientation: 'lengthwise' },
        { drawer_name: 'Kecil', length_mm: 350, width_mm: 300, height_mm: 100, quantity: 15, grain_orientation: 'lengthwise' },
      ],
    });

    const labels = result.jobs.flatMap((j) => j.pieces.map((p) => p.drawer_name));
    expect(new Set(labels)).toEqual(new Set(['Besar', 'Kecil']));
    expect(result.summary_by_drawer).toHaveLength(2);
  });

  test('include_bottom: panel alas ikut dihitung (1 per laci)', () => {
    const result = simulateCustomCutting({
      items: [{ drawer_name: 'A', length_mm: 500, width_mm: 400, height_mm: 150, quantity: 2, grain_orientation: 'any' }],
      include_bottom: true,
    });

    expect(result.summary_by_drawer[0].panel_count).toBe(10); // (4+1) x 2
    const bottoms = result.jobs[0].pieces.filter((p) => p.label.includes('Bottom'));
    expect(bottoms.length).toBe(2);
  });

  test('panel tidak muat -> error 422 dengan pesan label', () => {
    expect(() =>
      simulateCustomCutting({
        items: [{ drawer_name: 'Raksasa', length_mm: 3000, width_mm: 400, height_mm: 150, quantity: 1 }],
      }),
    ).toThrow('tidak muat pada lembaran');
  });
});

describe('cuttingOptimizationService.optimizeOrder', () => {
  const { optimizeOrder } = require('../src/services/cuttingOptimizationService');

  test('auto-generates component_items and fallback material for new customer order', async () => {
    let componentLoadCount = 0;
    const insertedComponents = [];
    const mockConn = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      execute: jest.fn(async (query, params) => {
        if (query.includes('FROM component_items ci')) {
          componentLoadCount += 1;
          if (componentLoadCount === 1) return [[], []];
          return [
            insertedComponents.map((c, idx) => ({
              id: idx + 1,
              component_type: c.component_type,
              raw_length_mm: c.raw_length_mm,
              raw_width_mm: c.raw_width_mm,
              grain_orientation: c.grain_orientation,
              quantity: c.quantity,
              material_id: c.material_id,
              material_name: 'LVB Standar (1220x2440 mm)',
              default_length_mm: 2440,
              default_width_mm: 1220,
            })),
            [],
          ];
        }
        if (query.includes('SELECT order_number, customer_id FROM orders')) {
          return [[{ order_number: 'PO-NEW-001', customer_id: 2 }], []];
        }
        if (query.includes('FROM order_items WHERE order_id = ?')) {
          return [
            [
              {
                id: 11,
                material_id: null,
                finished_length_mm: 450,
                finished_width_mm: 380,
                finished_height_mm: 140,
                quantity: 2,
              },
            ],
            [],
          ];
        }
        if (query.includes('SELECT COUNT(*) AS cnt FROM component_items')) {
          return [[{ cnt: 0 }], []];
        }
        if (query.includes('FROM materials')) {
          if (query.includes("material_code = 'STD-LVB-12'")) {
            return [[{ id: 99 }], []];
          }
          return [[], []];
        }
        if (query.includes('INSERT INTO component_items')) {
          insertedComponents.push({
            order_item_id: params[0],
            component_type: params[1],
            material_id: params[2],
            raw_length_mm: params[3],
            raw_width_mm: params[4],
            grain_orientation: params[5],
            quantity: params[6],
          });
          return [{ insertId: insertedComponents.length }, []];
        }
        if (query.includes('SELECT COUNT(*) AS cnt FROM cutting_jobs')) {
          return [[{ cnt: 0 }], []];
        }
        if (query.includes('FROM offcuts')) {
          return [[], []];
        }
        if (query.includes('INSERT INTO cutting_jobs')) {
          return [{ insertId: 77 }, []];
        }
        return [{ insertId: 1 }, []];
      }),
    };

    const mockPool = { getConnection: jest.fn().mockResolvedValue(mockConn) };
    const result = await optimizeOrder(mockPool, 42, null);

    expect(insertedComponents).toHaveLength(5);
    expect(insertedComponents.every((c) => c.material_id === 99)).toBe(true);
    expect(result.order_id).toBe(42);
    expect(result.total_sheets).toBe(1);
    expect(result.jobs[0].pieces).toHaveLength(10);
    expect(mockConn.commit).toHaveBeenCalledTimes(1);
  });
});
