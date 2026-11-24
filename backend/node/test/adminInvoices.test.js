process.env.JWT_SECRET = "test-secret-for-admin-invoice-tests";

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

describe("Admin invoice API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockConnectionExecute.mockReset();
    mockGetConnection.mockReset().mockResolvedValue(mockConnection);
    mockBeginTransaction.mockReset().mockResolvedValue();
    mockCommit.mockReset().mockResolvedValue();
    mockRollback.mockReset().mockResolvedValue();
    mockRelease.mockReset();
  });

  test("requires an authenticated admin to list invoices", async () => {
    const response = await request(app).get("/api/admin/invoices");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("lists invoice records and database summaries", async () => {
    mockDbExecute
      .mockResolvedValueOnce([[{ id: 8, invoice_number: "INV-TEST-008" }], []])
      .mockResolvedValueOnce([
        [
          {
            active_receivables: "120000",
            due_in_30_days: "30000",
            paid_this_year: "90000",
            active_invoice_count: 1,
            due_invoice_count: 1,
          },
        ],
        [],
      ]);

    const response = await request(app)
      .get("/api/admin/invoices")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data[0].invoice_number).toBe("INV-TEST-008");
    expect(response.body.summary.active_receivables).toBe("120000");
  });

  test("validates invoice input before opening a database transaction", async () => {
    const response = await request(app)
      .post("/api/admin/invoices")
      .set("Cookie", adminCookie)
      .send({ invoice_number: "INV-TEST-009" });

    expect(response.status).toBe(422);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test("creates an invoice linked to an existing order", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([[{ id: 7 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 31 }, []]);

    const response = await request(app)
      .post("/api/admin/invoices")
      .set("Cookie", adminCookie)
      .send({
        order_id: 7,
        invoice_number: "INV-TEST-007",
        invoice_date: "2026-11-01",
        due_date: "2027-01-30",
        total_amount: 250000,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: 31,
      invoice_number: "INV-TEST-007",
      order_id: 7,
      status: "unpaid",
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRollback).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test("records a partial payment and updates invoice balance transactionally", async () => {
    mockConnectionExecute
      .mockResolvedValueOnce([
        [
          {
            id: 31,
            invoice_number: "INV-TEST-007",
            total_amount: "250000.00",
            paid_amount: "50000.00",
            due_date: "2027-01-30",
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([{ insertId: 52 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const response = await request(app)
      .post("/api/admin/invoices/31/payments")
      .set("Cookie", adminCookie)
      .send({
        amount_paid: 50000,
        payment_date: "2026-11-24",
        payment_method: "bank_transfer",
        notes: "Test payment",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      invoice_id: 31,
      paid_amount: 100000,
      remaining_amount: 150000,
      status: "partially_paid",
    });
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRollback).not.toHaveBeenCalled();
  });

  test("rejects payments that exceed the remaining invoice balance", async () => {
    mockConnectionExecute.mockResolvedValueOnce([
      [
        {
          id: 31,
          invoice_number: "INV-TEST-007",
          total_amount: "250000.00",
          paid_amount: "200000.00",
          due_date: "2027-01-30",
        },
      ],
      [],
    ]);

    const response = await request(app)
      .post("/api/admin/invoices/31/payments")
      .set("Cookie", adminCookie)
      .send({
        amount_paid: 50001,
        payment_date: "2026-11-24",
        payment_method: "cash",
      });

    expect(response.status).toBe(409);
    expect(mockConnectionExecute).toHaveBeenCalledTimes(1);
    expect(mockRollback).toHaveBeenCalledTimes(1);
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
