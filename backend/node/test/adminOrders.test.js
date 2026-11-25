process.env.JWT_SECRET = "test-secret-for-admin-order-tests";

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

const orderPayload = {
  customer_id: 3,
  po_number: "BUYER-PO-003",
  order_date: "2026-11-25",
  top_days: 90,
  drawer_type_code: "MTO-DRAWER",
  length_mm: 400,
  width_mm: 150,
  height_mm: 350,
  quantity: 250,
};

describe("Admin order API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset().mockResolvedValue(mockConnection);
    mockBeginTransaction.mockReset().mockResolvedValue();
    mockCommit.mockReset().mockResolvedValue();
    mockRollback.mockReset().mockResolvedValue();
    mockRelease.mockReset();
  });

  test("requires an authenticated admin to list orders", async () => {
    const response = await request(app).get("/api/admin/orders");

    expect(response.status).toBe(401);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("returns orders and database-backed summaries", async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        [{ id: 8, po_number: "BUYER-PO-008", total_units: 250 }],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            active_orders: 4,
            production_orders: 2,
            production_units: 500,
            average_top_days: 90,
          },
        ],
        [],
      ]);

    const response = await request(app)
      .get("/api/admin/orders")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data[0].po_number).toBe("BUYER-PO-008");
    expect(response.body.summary.production_units).toBe(500);
  });

  test("validates order input before opening a database transaction", async () => {
    const response = await request(app)
      .post("/api/admin/orders")
      .set("Cookie", adminCookie)
      .send({ customer_id: 3 });

    expect(response.status).toBe(422);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test("creates the order, item, and tracking log transactionally", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([[{ id: 3 }], []])
      .mockResolvedValueOnce([{ insertId: 31 }, []])
      .mockResolvedValueOnce([{ insertId: 44 }, []])
      .mockResolvedValueOnce([{ insertId: 52 }, []]);

    const response = await request(app)
      .post("/api/admin/orders")
      .set("Cookie", adminCookie)
      .send(orderPayload);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: 31,
      po_number: "BUYER-PO-003",
      status: "draft",
    });
    expect(mockConnectionExecute).toHaveBeenCalledTimes(4);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRollback).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test("rejects orders for customers that do not exist", async () => {
    mockConnectionExecute.mockResolvedValueOnce([[], []]);

    const response = await request(app)
      .post("/api/admin/orders")
      .set("Cookie", adminCookie)
      .send(orderPayload);

    expect(response.status).toBe(404);
    expect(mockRollback).toHaveBeenCalledTimes(1);
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
