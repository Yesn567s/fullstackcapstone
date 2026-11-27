process.env.JWT_SECRET = "test-secret-for-operator-tests";

const mockDbExecute = jest.fn();
const mockConnectionExecute = jest.fn();
const mockGetConnection = jest.fn();
const mockBeginTransaction = jest.fn();
const mockCommit = jest.fn();
const mockRollback = jest.fn();
const mockRelease = jest.fn();

jest.mock("../src/config/db", () => ({
  execute: mockDbExecute,
  getConnection: mockGetConnection,
}));

const request = require("supertest");
const app = require("../src/app");
const { generateToken } = require("../src/middleware/auth");

const operatorCookie = `auth_token=${generateToken({ userId: 5, role: "operator" })}`;
const adminCookie = `auth_token=${generateToken({
  userId: null,
  username: "admin",
  role: "admin",
  hardcodedAdmin: true,
})}`;
const customerCookie = `auth_token=${generateToken({ userId: 9, role: "customer" })}`;

const mockConnection = {
  execute: (...args) => mockConnectionExecute(...args),
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
};

describe("Operator API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset().mockResolvedValue(mockConnection);
    mockBeginTransaction.mockReset().mockResolvedValue();
    mockCommit.mockReset().mockResolvedValue();
    mockRollback.mockReset().mockResolvedValue();
    mockRelease.mockReset();

    // Mock SELECT user untuk operator
    mockDbExecute.mockImplementation((query, params) => {
      if (query.includes("SELECT id, username, role FROM users WHERE id = ?")) {
        return Promise.resolve([
          [{ id: 5, username: 'operator_user', role: 'operator' }],
          [],
        ]);
      }
      if (query.includes("COUNT(*) AS cnt")) {
        return Promise.resolve([[{ cnt: 0, total_yield: 0 }], []]);
      }
      return Promise.resolve([[], []]);
    });
    mockConnectionExecute.mockResolvedValue([[{ insertId: 1 }], []]);
  });

  describe("RBAC", () => {
    test("rejects unauthenticated access to operator routes", async () => {
      const response = await request(app).get("/api/operator/summary");
      expect(response.status).toBe(401);
      expect(mockDbExecute).not.toHaveBeenCalled();
    });

    test("rejects customers from operator routes", async () => {
      const response = await request(app)
        .get("/api/operator/summary")
        .set("Cookie", customerCookie);
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test("allows admin via hardcodedAdmin bypass", async () => {
      mockDbExecute.mockResolvedValueOnce([[[], []]]);
      const response = await request(app)
        .get("/api/operator/summary")
        .set("Cookie", adminCookie);
      expect(response.status).toBe(200);
    });
  });

  describe("PATCH /api/operator/jobs/:id/status", () => {
    test("claims a pending unassigned job and sets operator_id", async () => {
      mockConnectionExecute.mockImplementation((query) => {
        if (query.includes("FROM cutting_jobs WHERE id = ? FOR UPDATE")) {
          return Promise.resolve([
            [{ id: 3, order_id: 10, status: "pending", operator_id: null, job_number: "CJ-001" }],
            [],
          ]);
        }
        if (query.includes("SELECT status FROM orders")) {
          return Promise.resolve([[{ status: "ready_for_production" }], []]);
        }
        return Promise.resolve([[{ insertId: 1 }], []]);
      });

      const response = await request(app)
        .patch("/api/operator/jobs/3/status")
        .set("Cookie", operatorCookie)
        .send({ status: "in_progress" });

      expect(response.status).toBe(200);
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, operator_id = ? WHERE id = ?",
        ["in_progress", 5, 3],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("START_CUTTING"),
        expect.anything(),
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE orders SET status = 'in_production' WHERE id = ?",
        [10],
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("rejects claiming a job owned by another operator", async () => {
      mockConnectionExecute.mockResolvedValueOnce([
        [{ id: 3, order_id: 10, status: "pending", operator_id: 7, job_number: "CJ-001" }],
        [],
      ]);

      const response = await request(app)
        .patch("/api/operator/jobs/3/status")
        .set("Cookie", operatorCookie)
        .send({ status: "in_progress" });

      expect(response.status).toBe(409);
      expect(mockRollback).toHaveBeenCalledTimes(1);
      expect(mockCommit).not.toHaveBeenCalled();
    });

    test("locks completion to the owning operator and stamps finished_at", async () => {
      mockConnectionExecute.mockImplementation((query) => {
        if (query.includes("FROM cutting_jobs WHERE id = ? FOR UPDATE")) {
          return Promise.resolve([
            [{ id: 3, order_id: 10, status: "in_progress", operator_id: 5, job_number: "CJ-001" }],
            [],
          ]);
        }
        if (query.includes("SELECT status FROM orders")) {
          return Promise.resolve([[{ status: "in_production" }], []]);
        }
        return Promise.resolve([[{ insertId: 1 }], []]);
      });

      const response = await request(app)
        .patch("/api/operator/jobs/3/status")
        .set("Cookie", operatorCookie)
        .send({ status: "completed" });

      expect(response.status).toBe(200);
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, finished_at = NOW() WHERE id = ?",
        ["completed", 3],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("FINISH_CUTTING"),
        expect.anything(),
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("rejects completion by a non-owner operator", async () => {
      mockConnectionExecute.mockResolvedValueOnce([
        [{ id: 3, order_id: 10, status: "in_progress", operator_id: 7, job_number: "CJ-001" }],
        [],
      ]);

      const response = await request(app)
        .patch("/api/operator/jobs/3/status")
        .set("Cookie", operatorCookie)
        .send({ status: "completed" });

      expect(response.status).toBe(403);
      expect(mockRollback).toHaveBeenCalledTimes(1);
    });

    test("rejects invalid status values", async () => {
      const response = await request(app)
        .patch("/api/operator/jobs/3/status")
        .set("Cookie", operatorCookie)
        .send({ status: "paused" });
      expect(response.status).toBe(422);
    });

    test("returns 404 for unknown job", async () => {
      mockConnectionExecute.mockResolvedValueOnce([[], []]);
      const response = await request(app)
        .patch("/api/operator/jobs/999/status")
        .set("Cookie", operatorCookie)
        .send({ status: "in_progress" });
      expect(response.status).toBe(404);
      expect(mockRollback).toHaveBeenCalledTimes(1);
    });
  });

  describe("PATCH /api/operator/jobs/bulk-status", () => {
    test("starts all eligible pending jobs in one transaction", async () => {
      mockConnectionExecute.mockImplementation((query) => {
        if (query.includes("FROM cutting_jobs") && query.includes("FOR UPDATE")) {
          return Promise.resolve([
            [
              { id: 3, order_id: 10, status: "pending", operator_id: null, job_number: "CJ-001" },
              { id: 4, order_id: 10, status: "pending", operator_id: 5, job_number: "CJ-002" },
            ],
            [],
          ]);
        }
        if (query.includes("SELECT status FROM orders")) {
          return Promise.resolve([[{ status: "ready_for_production" }], []]);
        }
        return Promise.resolve([{ insertId: 1 }], []);
      });

      const response = await request(app)
        .patch("/api/operator/jobs/bulk-status")
        .set("Cookie", operatorCookie)
        .send({ status: "in_progress" });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ updatedCount: 2, status: "in_progress" });
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, operator_id = ? WHERE id = ?",
        ["in_progress", 5, 3],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, operator_id = ? WHERE id = ?",
        ["in_progress", 5, 4],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE orders SET status = 'in_production' WHERE id = ?",
        [10],
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("completes all in-progress jobs owned by the operator", async () => {
      mockConnectionExecute.mockImplementation((query) => {
        if (query.includes("FROM cutting_jobs") && query.includes("FOR UPDATE")) {
          return Promise.resolve([
            [
              { id: 3, order_id: 10, status: "in_progress", operator_id: 5, job_number: "CJ-001" },
              { id: 4, order_id: 10, status: "in_progress", operator_id: 5, job_number: "CJ-002" },
            ],
            [],
          ]);
        }
        if (query.includes("SELECT status FROM orders")) {
          return Promise.resolve([[{ status: "in_production" }], []]);
        }
        return Promise.resolve([{ insertId: 1 }], []);
      });

      const response = await request(app)
        .patch("/api/operator/jobs/bulk-status")
        .set("Cookie", operatorCookie)
        .send({ status: "completed" });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ updatedCount: 2, status: "completed" });
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, finished_at = NOW() WHERE id = ?",
        ["completed", 3],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        "UPDATE cutting_jobs SET status = ?, finished_at = NOW() WHERE id = ?",
        ["completed", 4],
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("returns 409 when no eligible jobs exist for bulk transition", async () => {
      mockConnectionExecute.mockResolvedValueOnce([[], []]);

      const response = await request(app)
        .patch("/api/operator/jobs/bulk-status")
        .set("Cookie", operatorCookie)
        .send({ status: "in_progress" });

      expect(response.status).toBe(409);
      expect(mockRollback).toHaveBeenCalledTimes(1);
      expect(mockCommit).not.toHaveBeenCalled();
    });

    test("rejects invalid bulk status values", async () => {
      const response = await request(app)
        .patch("/api/operator/jobs/bulk-status")
        .set("Cookie", operatorCookie)
        .send({ status: "pending" });

      expect(response.status).toBe(422);
      expect(mockGetConnection).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/operator/jobs/:id/patterns", () => {
    test("returns job with patterns ordered by cut_step_order", async () => {
      mockDbExecute.mockImplementation((query) => {
        if (query.includes("SELECT id, username, role FROM users WHERE id = ?")) {
          return Promise.resolve([
            [{ id: 5, username: 'operator_user', role: 'operator' }],
            [],
          ]);
        }
        if (query.includes("FROM cutting_jobs cj")) {
          return Promise.resolve([
            [{
              id: 3, job_number: "CJ-001", status: "in_progress",
              source_sheet_length: "2440.00", source_sheet_width: "1220.00",
              kerf_thickness_mm: "3.00", order_id: 10, order_number: "PO-10",
              material_name: "LVB Sengon", thickness_mm: "12.00",
            }],
            [],
          ]);
        }
        if (query.includes("FROM cutting_patterns cp")) {
          return Promise.resolve([
            [
              { id: 1, label: "Dasar", cut_step_order: 1, width_mm: "480", height_mm: "140" },
              { id: 2, label: "Dinding", cut_step_order: 2, width_mm: "500", height_mm: "150" },
            ],
            [],
          ]);
        }
        return Promise.resolve([[], []]);
      });

      const response = await request(app)
        .get("/api/operator/jobs/3/patterns")
        .set("Cookie", operatorCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.patterns[0].cut_step_order).toBe(1);
      expect(response.body.data.patterns[1].cut_step_order).toBe(2);
      expect(response.body.data.patterns).toHaveLength(2);
    });

    test("returns 404 for unknown job", async () => {
      // mockDbExecute default: users SELECT valid, cutting_jobs tidak ada -> []  -> 404
      const response = await request(app)
        .get("/api/operator/jobs/999/patterns")
        .set("Cookie", operatorCookie);
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/operator/orders/:id/stage", () => {
    test("records a production stage with tracking and activity logs", async () => {
      mockConnectionExecute.mockResolvedValueOnce([
        [{ id: 10, order_number: "PO-10", status: "in_production" }],
        [],
      ]);

      const response = await request(app)
        .patch("/api/operator/orders/10/stage")
        .set("Cookie", operatorCookie)
        .send({ stage: "Assembly", description: "Rangka laci 1-4 selesai." });

      expect(response.status).toBe(200);
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("po_tracking_logs"),
        [10, "Assembly", "Rangka laci 1-4 selesai.", 5],
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE_PRODUCTION_STATUS"),
        expect.anything(),
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("rejects invalid stage values", async () => {
      const response = await request(app)
        .patch("/api/operator/orders/10/stage")
        .set("Cookie", operatorCookie)
        .send({ stage: "Painting" });
      expect(response.status).toBe(422);
    });

    test("returns 404 for unknown order", async () => {
      mockConnectionExecute.mockResolvedValueOnce([[], []]);
      const response = await request(app)
        .patch("/api/operator/orders/999/stage")
        .set("Cookie", operatorCookie)
        .send({ stage: "Cutting" });
      expect(response.status).toBe(404);
      expect(mockRollback).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/operator/offcuts", () => {
    test("lists aggregated offcut stock and inventory totals", async () => {
      mockDbExecute.mockImplementation((query) => {
        if (query.includes("FROM users WHERE id = ?")) {
          return Promise.resolve([
            [{ id: 5, username: "operator_user", role: "operator" }],
            [],
          ]);
        }
        if (query.includes("FROM offcuts o")) {
          return Promise.resolve([
            [
              {
                id: 12,
                quantity: 3,
                material_id: 2,
                material_name: "LVB Sengon",
                width_mm: "400.00",
                length_mm: "600.00",
                status: "available",
              },
            ],
            [],
          ]);
        }
        return Promise.resolve([
          [
            {
              total_pieces: 8,
              available_pieces: 5,
              reserved_pieces: 2,
            },
          ],
          [],
        ]);
      });

      const response = await request(app)
        .get("/api/operator/offcuts")
        .set("Cookie", operatorCookie);

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({
        id: 12,
        quantity: 3,
        material_name: "LVB Sengon",
      });
      expect(response.body.summary).toMatchObject({
        total_pieces: 8,
        available_pieces: 5,
      });
    });

    test("lists material choices from the materials table", async () => {
      mockDbExecute.mockImplementation((query) =>
        Promise.resolve([
          query.includes("FROM users WHERE id = ?")
            ? [{ id: 5, username: "operator_user", role: "operator" }]
            : [{ id: 2, material_name: "LVB Sengon", thickness_mm: "12.00" }],
          [],
        ]),
      );

      const response = await request(app)
        .get("/api/operator/offcuts/materials")
        .set("Cookie", operatorCookie);

      expect(response.status).toBe(200);
      expect(response.body.data[0].material_name).toBe("LVB Sengon");
    });

    test("stores an available offcut and logs activity", async () => {
      mockConnectionExecute
        .mockResolvedValueOnce([[{ id: 2, material_name: "LVB Sengon" }], []])
        .mockResolvedValueOnce([{ insertId: 42 }, []]);

      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", operatorCookie)
        .send({
          material_id: 2,
          customer_id: 1,
          length_mm: 600,
          width_mm: 400,
          grain_orientation: "widthwise",
          location_tag: "Rak B2",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe(42);
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO offcuts"),
        expect.arrayContaining([2, 1, 600, 400, "widthwise", "Rak B2"]),
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("INPUT_OFFCUT"),
        expect.anything(),
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("stores requested quantities as individual offcut rows in one transaction", async () => {
      mockConnectionExecute
        .mockResolvedValueOnce([[{ id: 2, material_name: "LVB Sengon" }], []])
        .mockResolvedValueOnce([{ insertId: 60 }, []])
        .mockResolvedValueOnce([{ insertId: 61 }, []])
        .mockResolvedValueOnce([{ insertId: 62 }, []])
        .mockResolvedValueOnce([{ insertId: 1 }, []]);

      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", operatorCookie)
        .send({
          material_id: 2,
          length_mm: 600,
          width_mm: 400,
          quantity: 3,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        id: 60,
        quantity: 3,
        audit_logged: true,
      });
      expect(mockConnectionExecute).toHaveBeenCalledTimes(5);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("allows the demo admin to add stock and reports that it cannot be audit logged", async () => {
      mockConnectionExecute
        .mockResolvedValueOnce([[{ id: 2, material_name: "LVB Sengon" }], []])
        .mockResolvedValueOnce([{ insertId: 63 }, []]);

      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", adminCookie)
        .send({ material_id: 2, length_mm: 600, width_mm: 400 });

      expect(response.status).toBe(201);
      expect(response.body.data.audit_logged).toBe(false);
      expect(response.body.message).toMatch(/tidak tercatat/i);
      expect(mockConnectionExecute).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("rejects unknown material", async () => {
      mockConnectionExecute.mockResolvedValueOnce([[], []]);
      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", operatorCookie)
        .send({ material_id: 999, length_mm: 600, width_mm: 400 });
      expect(response.status).toBe(422);
      expect(mockRollback).toHaveBeenCalledTimes(1);
    });

    test("rejects invalid dimensions", async () => {
      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", operatorCookie)
        .send({ material_id: 2, length_mm: -5, width_mm: 400 });
      expect(response.status).toBe(422);
    });

    test("rejects offcut quantities above the bulk limit", async () => {
      const response = await request(app)
        .post("/api/operator/offcuts")
        .set("Cookie", operatorCookie)
        .send({ material_id: 2, length_mm: 600, width_mm: 400, quantity: 501 });

      expect(response.status).toBe(422);
      expect(mockGetConnection).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/operator/qc", () => {
    test("computes overall_status passed and logs tracking", async () => {
      mockConnectionExecute
        .mockResolvedValueOnce([[{ id: 10, order_number: "PO-10" }], []])
        .mockResolvedValueOnce([{ insertId: 77 }, []]);

      const response = await request(app)
        .post("/api/operator/qc")
        .set("Cookie", operatorCookie)
        .send({
          order_id: 10,
          quantity_inspected: 12,
          squareness_passed: true,
          dimension_passed: true,
          notes: "Semua laci lolos.",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.overall_status).toBe("passed");
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO qc_inspections"),
        expect.arrayContaining([10, expect.any(String), 5, 12, 1, 1, "passed", "Semua laci lolos."]),
      );
      expect(mockConnectionExecute).toHaveBeenCalledWith(
        expect.stringContaining("SUBMIT_QC"),
        expect.anything(),
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    test("computes overall_status rejected when one check fails", async () => {
      mockConnectionExecute
        .mockResolvedValueOnce([[{ id: 10, order_number: "PO-10" }], []])
        .mockResolvedValueOnce([{ insertId: 78 }, []]);

      const response = await request(app)
        .post("/api/operator/qc")
        .set("Cookie", operatorCookie)
        .send({
          order_id: 10,
          quantity_inspected: 12,
          squareness_passed: true,
          dimension_passed: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.overall_status).toBe("rejected");
    });

    test("rejects unknown order", async () => {
      mockConnectionExecute.mockResolvedValueOnce([[], []]);
      const response = await request(app)
        .post("/api/operator/qc")
        .set("Cookie", operatorCookie)
        .send({
          order_id: 999,
          quantity_inspected: 5,
          squareness_passed: true,
          dimension_passed: true,
        });
      expect(response.status).toBe(422);
      expect(mockRollback).toHaveBeenCalledTimes(1);
    });

    test("rejects invalid payload", async () => {
      const response = await request(app)
        .post("/api/operator/qc")
        .set("Cookie", operatorCookie)
        .send({ order_id: 10, quantity_inspected: 0 });
      expect(response.status).toBe(422);
    });
  });
});
