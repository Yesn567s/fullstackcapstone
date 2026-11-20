process.env.JWT_SECRET = "test-secret-for-admin-delivery-tests";

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

const adminCookie = `auth_token=${generateToken({
  userId: null,
  username: "admin",
  role: "admin",
  hardcodedAdmin: true,
})}`;

const mockConnection = {
  execute: (...args) => mockConnectionExecute(...args),
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
  release: mockRelease,
};

describe("Admin delivery API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset().mockResolvedValue(mockConnection);
    mockBeginTransaction.mockReset().mockResolvedValue();
    mockCommit.mockReset().mockResolvedValue();
    mockRollback.mockReset().mockResolvedValue();
    mockRelease.mockReset();
  });

  test("requires an authenticated admin to list delivery notes", async () => {
    const response = await request(app).get("/api/admin/deliveries");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("lists delivery notes from the database", async () => {
    mockDbExecute.mockResolvedValueOnce([
      [
        {
          id: 8,
          delivery_note_number: "SJ-TEST-008",
          order_number: "PO-TEST-008",
          po_number: "BUYER-PO-008",
          company_name: "Example Furniture",
          quantity_shipped: 3,
          received_status: 0,
        },
      ],
      [],
    ]);

    const response = await request(app)
      .get("/api/admin/deliveries")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].delivery_note_number).toBe("SJ-TEST-008");
  });

  test("validates delivery input before opening a database transaction", async () => {
    const response = await request(app)
      .post("/api/admin/deliveries")
      .set("Cookie", adminCookie)
      .send({ order_id: 7 });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test("creates a partial shipment and updates order status transactionally", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([
        [{ id: 7, order_number: "PO-TEST-007", status: "in_production" }],
        [],
      ])
      .mockResolvedValueOnce([[{ id: 19, overall_status: "passed" }], []])
      .mockResolvedValueOnce([
        [{ id: 70, quantity: 10, shipped_quantity: 3 }],
        [],
      ])
      .mockResolvedValueOnce([{ insertId: 88 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const response = await request(app)
      .post("/api/admin/deliveries")
      .set("Cookie", adminCookie)
      .send({
        order_id: 7,
        delivery_note_number: "SJ-TEST-007",
        delivery_date: "2026-11-20",
        truck_plate_number: "D 1234 TEST",
        driver_name: "Test Driver",
        items: [{ order_item_id: 70, quantity_shipped: 2 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: 88,
      order_id: 7,
      quantity_shipped: 2,
      received_status: false,
      order_status: "partially_shipped",
    });
    expect(mockConnectionExecute.mock.calls[5][1]).toEqual([
      "partially_shipped",
      7,
    ]);
    expect(mockBeginTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRollback).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test("marks an order completed when its final remaining quantity ships", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([
        [{ id: 7, order_number: "PO-TEST-007", status: "partially_shipped" }],
        [],
      ])
      .mockResolvedValueOnce([[{ id: 19, overall_status: "passed" }], []])
      .mockResolvedValueOnce([
        [{ id: 70, quantity: 5, shipped_quantity: 4 }],
        [],
      ])
      .mockResolvedValueOnce([{ insertId: 88 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const response = await request(app)
      .post("/api/admin/deliveries")
      .set("Cookie", adminCookie)
      .send({
        order_id: 7,
        delivery_note_number: "SJ-TEST-007-FINAL",
        delivery_date: "2026-11-20",
        truck_plate_number: "D 1234 TEST",
        items: [{ order_item_id: 70, quantity_shipped: 1 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.order_status).toBe("completed");
    expect(mockConnectionExecute).toHaveBeenCalledTimes(8);
    expect(mockConnectionExecute.mock.calls[5][1]).toEqual(["completed", 7]);
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  test("rejects shipments that exceed the remaining order quantity", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([
        [{ id: 7, order_number: "PO-TEST-007", status: "in_production" }],
        [],
      ])
      .mockResolvedValueOnce([[{ id: 19, overall_status: "passed" }], []])
      .mockResolvedValueOnce([
        [{ id: 70, quantity: 10, shipped_quantity: 9 }],
        [],
      ]);

    const response = await request(app)
      .post("/api/admin/deliveries")
      .set("Cookie", adminCookie)
      .send({
        order_id: 7,
        delivery_note_number: "SJ-TEST-007",
        delivery_date: "2026-11-20",
        truck_plate_number: "D 1234 TEST",
        items: [{ order_item_id: 70, quantity_shipped: 2 }],
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(mockConnectionExecute).toHaveBeenCalledTimes(3);
    expect(mockRollback).toHaveBeenCalledTimes(1);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  test("does not create a delivery when the latest QC inspection failed", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([
        [{ id: 7, order_number: "PO-TEST-007", status: "in_production" }],
        [],
      ])
      .mockResolvedValueOnce([[{ id: 19, overall_status: "rejected" }], []]);

    const response = await request(app)
      .post("/api/admin/deliveries")
      .set("Cookie", adminCookie)
      .send({
        order_id: 7,
        delivery_note_number: "SJ-TEST-007",
        delivery_date: "2026-11-20",
        truck_plate_number: "D 1234 TEST",
        items: [{ order_item_id: 70, quantity_shipped: 1 }],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/QC lulus/i);
    expect(mockConnectionExecute).toHaveBeenCalledTimes(2);
    expect(mockRollback).toHaveBeenCalledTimes(1);
  });
});
