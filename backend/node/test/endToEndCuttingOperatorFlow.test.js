process.env.JWT_SECRET = 'test-secret-for-e2e-flow';

const fs = require('fs');
const path = require('path');

const mockDbExecute = jest.fn();
const mockConnectionExecute = jest.fn();
const mockGetConnection = jest.fn();
const mockBeginTransaction = jest.fn();
const mockCommit = jest.fn();
const mockRollback = jest.fn();
const mockRelease = jest.fn();

jest.mock('../src/config/db', () => ({
  execute: mockDbExecute,
  getConnection: mockGetConnection,
}));

const request = require('supertest');
const app = require('../src/app');
const { UPLOAD_ROOT } = require('../src/middleware/upload');
const { generateToken } = require('../src/middleware/auth');

const adminCookie = `auth_token=${generateToken({
  userId: 1,
  username: 'admin',
  role: 'admin',
})}`;
const operatorCookie = `auth_token=${generateToken({
  userId: 5,
  role: 'operator',
})}`;
const customerCookie = `auth_token=${generateToken({
  userId: 9,
  role: 'customer',
})}`;

const mockConnection = {
  execute: (...args) => mockConnectionExecute(...args),
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
};

describe('Upload static serving & End-to-End Admin Optimize -> Operator -> QC -> Delivery -> Customer ACC', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset().mockResolvedValue(mockConnection);
    mockBeginTransaction.mockReset().mockResolvedValue();
    mockCommit.mockReset().mockResolvedValue();
    mockRollback.mockReset().mockResolvedValue();
    mockRelease.mockReset();
  });

  test('GET /uploads/payments/:file serves files from upload.js UPLOAD_ROOT (backend/uploads)', async () => {
    const paymentsDir = path.join(UPLOAD_ROOT, 'payments');
    fs.mkdirSync(paymentsDir, { recursive: true });
    const testFilename = `test-dp-${Date.now()}.txt`;
    const testFilePath = path.join(paymentsDir, testFilename);
    fs.writeFileSync(testFilePath, 'dp-proof-ok');

    try {
      const res = await request(app).get(`/uploads/payments/${testFilename}`);
      expect(res.status).toBe(200);
      expect(res.text).toBe('dp-proof-ok');
    } finally {
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    }
  });

  test('Full flow: Admin Optimize (operator_id NULL) -> Operator Start/Finish -> Stage -> QC -> Delivery -> Customer ACC & Selesai', async () => {
    // 1. Admin runs POST /api/cutting/optimize
    mockDbExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 1, username: 'admin', role: 'admin' }], []]);
      }
      return Promise.resolve([[], []]);
    });

    let insertedOperatorId = 'NOT_SET';
    mockConnectionExecute.mockImplementation((query, params) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 1, username: 'admin', role: 'admin' }], []]);
      }
      if (query.includes('FROM component_items ci')) {
        return Promise.resolve([
          [
            {
              component_item_id: 101,
              component_type: 'front',
              material_id: 1,
              raw_length_mm: 404,
              raw_width_mm: 150,
              grain_orientation: 'lengthwise',
              quantity: 1,
              default_length_mm: 2440,
              default_width_mm: 1220,
              drawer_type_code: 'LACI-A',
            },
          ],
          [],
        ]);
      }
      if (query.includes('SELECT order_number, customer_id FROM orders')) {
        return Promise.resolve([[{ order_number: 'PO-TEST-001', customer_id: 10 }], []]);
      }
      if (query.includes('SELECT COUNT(*) AS cnt FROM cutting_jobs')) {
        return Promise.resolve([[{ cnt: 0 }], []]);
      }
      if (query.includes('FROM offcuts')) {
        return Promise.resolve([[], []]);
      }
      if (query.includes('INSERT INTO cutting_jobs')) {
        insertedOperatorId = params[9];
        return Promise.resolve([{ insertId: 50 }, []]);
      }
      return Promise.resolve([{ insertId: 1 }, []]);
    });

    const optRes = await request(app)
      .post('/api/cutting/optimize')
      .set('Cookie', adminCookie)
      .send({ order_id: 7 });

    expect(optRes.status).toBe(200);
    expect(optRes.body.success).toBe(true);
    expect(optRes.body.data.total_sheets).toBe(1);
    expect(insertedOperatorId).toBeNull();

    // 2. Operator sees job in GET /api/operator/summary, starts & finishes it
    mockDbExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 5, username: 'op1', role: 'operator' }], []]);
      }
      if (query.includes('FROM cutting_jobs cj')) {
        return Promise.resolve([
          [
            {
              id: 50,
              job_number: 'CJ-PO-TEST-001-001',
              status: 'pending',
              order_number: 'PO-TEST-001',
              order_id: 7,
              material_name: 'LVB Poplar',
              thickness_mm: 15,
            },
          ],
          [],
        ]);
      }
      if (query.includes('COUNT(*) AS cnt')) {
        return Promise.resolve([[{ cnt: 0, total_yield: 0 }], []]);
      }
      return Promise.resolve([[], []]);
    });

    const summaryRes = await request(app)
      .get('/api/operator/summary')
      .set('Cookie', operatorCookie);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data.activeJobs).toHaveLength(1);
    expect(summaryRes.body.data.activeJobs[0].id).toBe(50);

    // Operator starts job (in_progress)
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('FROM cutting_jobs WHERE id = ? FOR UPDATE')) {
        return Promise.resolve([
          [{ id: 50, order_id: 7, status: 'pending', operator_id: null, job_number: 'CJ-PO-TEST-001-001' }],
          [],
        ]);
      }
      if (query.includes('SELECT status FROM orders')) {
        return Promise.resolve([[{ status: 'ready_for_production' }], []]);
      }
      return Promise.resolve([{ insertId: 1 }, []]);
    });

    const startRes = await request(app)
      .patch('/api/operator/jobs/50/status')
      .set('Cookie', operatorCookie)
      .send({ status: 'in_progress' });
    expect(startRes.status).toBe(200);

    // Operator completes job (completed)
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('FROM cutting_jobs WHERE id = ? FOR UPDATE')) {
        return Promise.resolve([
          [{ id: 50, order_id: 7, status: 'in_progress', operator_id: 5, job_number: 'CJ-PO-TEST-001-001' }],
          [],
        ]);
      }
      if (query.includes('SELECT status FROM orders')) {
        return Promise.resolve([[{ status: 'in_production' }], []]);
      }
      return Promise.resolve([{ insertId: 1 }, []]);
    });

    const finishRes = await request(app)
      .patch('/api/operator/jobs/50/status')
      .set('Cookie', operatorCookie)
      .send({ status: 'completed' });
    expect(finishRes.status).toBe(200);

    // 3. Operator records Assembly stage & submits QC Passed
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, order_number, status FROM orders')) {
        return Promise.resolve([[{ id: 7, order_number: 'PO-TEST-001', status: 'in_production' }], []]);
      }
      if (query.includes('SELECT id, order_number FROM orders')) {
        return Promise.resolve([[{ id: 7, order_number: 'PO-TEST-001' }], []]);
      }
      return Promise.resolve([{ insertId: 77 }, []]);
    });

    const stageRes = await request(app)
      .patch('/api/operator/orders/7/stage')
      .set('Cookie', operatorCookie)
      .send({ stage: 'Assembly', description: 'Perakitan selesai' });
    expect(stageRes.status).toBe(200);

    const qcRes = await request(app)
      .post('/api/operator/qc')
      .set('Cookie', operatorCookie)
      .send({
        order_id: 7,
        quantity_inspected: 10,
        squareness_passed: true,
        dimension_passed: true,
      });
    expect(qcRes.status).toBe(201);
    expect(qcRes.body.data.overall_status).toBe('passed');

    // 4. Customer confirms delivery (ACC & Selesai)
    mockDbExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 9, username: 'buyer1', role: 'customer' }], []]);
      }
      if (query.includes('FROM customers c')) {
        return Promise.resolve([[{ id: 10, company_name: 'PT Buyer Test', loyalty_tier_id: 1 }], []]);
      }
      return Promise.resolve([[], []]);
    });

    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('FROM deliveries d')) {
        return Promise.resolve([[{ id: 88, order_id: 7, quantity_shipped: 10 }], []]);
      }
      if (query.includes('total_ordered')) {
        return Promise.resolve([[{ total_ordered: 10, total_received: 10 }], []]);
      }
      return Promise.resolve([{ affectedRows: 1 }, []]);
    });

    const accRes = await request(app)
      .patch('/api/customer/deliveries/88/confirm')
      .set('Cookie', customerCookie);

    expect(accRes.status).toBe(200);
    expect(accRes.body.success).toBe(true);
    expect(accRes.body.data.received_status).toBe(true);
    expect(accRes.body.data.order_completed).toBe(true);
    expect(mockConnectionExecute).toHaveBeenCalledWith(
      "UPDATE orders SET status = 'completed' WHERE id = ?",
      [7],
    );
  });

  test('GET /api/customer/orders/:id/tracking consolidates multiple Cutting logs into one summary status', async () => {
    const setupTrackingMocks = (cuttingSummaryRow) => {
      mockDbExecute.mockImplementation((query) => {
        if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
          return Promise.resolve([[{ id: 9, username: 'buyer1', role: 'customer' }], []]);
        }
        if (query.includes('FROM customers c')) {
          return Promise.resolve([[{ id: 10, company_name: 'PT Buyer Test', loyalty_tier_id: 1 }], []]);
        }
        if (query.includes('SELECT * FROM orders WHERE id = ? AND customer_id = ?')) {
          return Promise.resolve([[{ id: 7, order_number: 'PO-TEST-001', order_date: '2026-11-27', status: 'in_production' }], []]);
        }
        if (query.includes('FROM po_tracking_logs')) {
          return Promise.resolve([
            [
              { stage: 'DP_Verified', affected_quantity: null, status_description: 'DP diverifikasi.', updated_at: '2026-11-27T08:00:00Z' },
              { stage: 'Cutting', affected_quantity: null, status_description: 'Pemotongan dimulai (CJ-001).', updated_at: '2026-11-27T09:00:00Z' },
              { stage: 'Cutting', affected_quantity: null, status_description: 'Pemotongan selesai (CJ-001).', updated_at: '2026-11-27T09:30:00Z' },
              { stage: 'Cutting', affected_quantity: null, status_description: 'Pemotongan dimulai (CJ-002).', updated_at: '2026-11-27T10:00:00Z' },
            ],
            [],
          ]);
        }
        if (query.includes('FROM cutting_jobs')) {
          return Promise.resolve([[cuttingSummaryRow], []]);
        }
        return Promise.resolve([[], []]);
      });
    };

    // 1. Not all cutting jobs finished yet (1 of 2 finished)
    setupTrackingMocks({
      total_jobs: 2,
      completed_jobs: 1,
      in_progress_jobs: 1,
      pending_jobs: 0,
      last_finished_at: '2026-11-27T09:30:00Z',
      last_created_at: '2026-11-27T08:30:00Z',
    });

    const partialRes = await request(app)
      .get('/api/customer/orders/7/tracking')
      .set('Cookie', customerCookie);

    expect(partialRes.status).toBe(200);
    const partialCutting = partialRes.body.data.timeline.filter((t) => t.stage === 'Cutting');
    expect(partialCutting).toHaveLength(1);
    expect(partialCutting[0].is_completed).toBe(false);
    expect(partialCutting[0].status_description).toMatch(/belum semua selesai/i);
    expect(partialRes.body.data.cutting_summary.all_completed).toBe(false);

    // 2. All cutting jobs finished (2 of 2 finished)
    setupTrackingMocks({
      total_jobs: 2,
      completed_jobs: 2,
      in_progress_jobs: 0,
      pending_jobs: 0,
      last_finished_at: '2026-11-27T11:00:00Z',
      last_created_at: '2026-11-27T08:30:00Z',
    });

    const doneRes = await request(app)
      .get('/api/customer/orders/7/tracking')
      .set('Cookie', customerCookie);

    expect(doneRes.status).toBe(200);
    const doneCutting = doneRes.body.data.timeline.filter((t) => t.stage === 'Cutting');
    expect(doneCutting).toHaveLength(1);
    expect(doneCutting[0].is_completed).toBe(true);
    expect(doneCutting[0].status_description).toMatch(/semua proses pemotongan.*selesai/i);
    expect(doneRes.body.data.cutting_summary.all_completed).toBe(true);
  });

  test('RMA & ACC Final flow: Admin acknowledge -> Send rework to Operator -> Customer ACC Final', async () => {
    // 1. Admin lists RMA
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 1, username: 'admin', role: 'admin' }], []]);
      }
      return Promise.resolve([[], []]);
    });
    mockDbExecute.mockImplementation((query) => {
      if (query.includes('FROM rma_requests r')) {
        return Promise.resolve([
          [{ id: 15, rma_number: 'RMA-15', order_id: 7, verification_status: 'pending', action_type: 'replacement' }],
          [],
        ]);
      }
      return Promise.resolve([[], []]);
    });

    const listRmaRes = await request(app)
      .get('/api/admin/rma')
      .set('Cookie', adminCookie);
    expect(listRmaRes.status).toBe(200);
    expect(listRmaRes.body.data[0].rma_number).toBe('RMA-15');

    // 2. Admin acknowledges RMA
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 1, username: 'admin', role: 'admin' }], []]);
      }
      if (query.includes('FROM rma_requests r') && query.includes('FOR UPDATE')) {
        return Promise.resolve([
          [{ id: 15, rma_number: 'RMA-15', order_id: 7, verification_status: 'pending', claim_reason: 'Retak', order_number: 'PO-7' }],
          [],
        ]);
      }
      return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
    });

    const ackRes = await request(app)
      .patch('/api/admin/rma/15/acknowledge')
      .set('Cookie', adminCookie)
      .send({ action: 'acknowledge', admin_notes: 'Kirim balik barang cacat.' });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.verification_status).toBe('verified');

    // 3. Admin sends RMA rework job to Operator
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 1, username: 'admin', role: 'admin' }], []]);
      }
      if (query.includes('FROM rma_requests r') && query.includes('FOR UPDATE')) {
        return Promise.resolve([
          [{ id: 15, rma_number: 'RMA-15', order_id: 7, verification_status: 'verified', action_type: 'replacement', order_number: 'PO-7' }],
          [],
        ]);
      }
      if (query.includes('FROM cutting_jobs') && query.includes('job_number LIKE ?')) {
        return Promise.resolve([[], []]);
      }
      if (query.includes('FROM order_items oi')) {
        return Promise.resolve([[{ material_id: 1, default_length_mm: 2440, default_width_mm: 1220 }], []]);
      }
      if (query.includes('INSERT INTO cutting_jobs')) {
        return Promise.resolve([{ insertId: 99 }, []]);
      }
      return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
    });

    const reworkRes = await request(app)
      .post('/api/admin/rma/15/send-to-operator')
      .set('Cookie', adminCookie);
    expect(reworkRes.status).toBe(201);
    expect(reworkRes.body.data.job_number).toMatch(/^CJ-RMA-15-/);

    // 4. Customer confirms ACC Final after receiving goods
    mockDbExecute.mockImplementation((query) => {
      if (query.includes('SELECT id, username, role FROM users WHERE id = ?')) {
        return Promise.resolve([[{ id: 9, username: 'buyer1', role: 'customer' }], []]);
      }
      if (query.includes('FROM customers c')) {
        return Promise.resolve([[{ id: 10, company_name: 'PT Buyer Test', loyalty_tier_id: 1 }], []]);
      }
      return Promise.resolve([[], []]);
    });
    mockConnectionExecute.mockImplementation((query) => {
      if (query.includes('SELECT * FROM orders WHERE id = ? AND customer_id = ?')) {
        return Promise.resolve([[{ id: 7, order_number: 'PO-7', status: 'partially_shipped' }], []]);
      }
      if (query.includes('FROM deliveries WHERE order_id = ?')) {
        return Promise.resolve([[{ received_count: 1 }], []]);
      }
      if (query.includes('FROM rma_requests')) {
        return Promise.resolve([[{ cnt: 0 }], []]);
      }
      return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
    });

    const accFinalRes = await request(app)
      .post('/api/customer/orders/7/accept-final')
      .set('Cookie', customerCookie);
    expect(accFinalRes.status).toBe(200);
    expect(accFinalRes.body.data.final_accepted).toBe(true);
  });
});
