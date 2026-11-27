process.env.JWT_SECRET = "test-secret-for-admin-dashboard-tests";

const mockDbExecute = jest.fn();

jest.mock("../src/config/db", () => ({
  execute: mockDbExecute,
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

describe("Admin dashboard API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
  });

  test("requires an authenticated admin", async () => {
    const response = await request(app).get("/api/admin/dashboard");

    expect(response.status).toBe(401);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("returns database-backed dashboard analytics", async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        [
          {
            total_orders: 4,
            active_orders: 3,
            all_active_orders: 8,
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            job_count: 2,
            average_yield: "91.50",
            average_waste: "8.50",
            offcut_usage_percent: "50.00",
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([
        [{ active_receivables: "120000", active_invoice_count: 2 }],
        [],
      ])
      .mockResolvedValueOnce([
        [{ month: "2026-11", average_yield: "91.50" }],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            invoice_number: "INV-TEST-001",
            company_name: "Test Furniture",
            due_date: "2026-11-30",
            remaining_amount: "60000",
            status: "unpaid",
          },
        ],
        [],
      ]);

    const response = await request(app)
      .get("/api/admin/dashboard?period=this-month")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.kpis).toMatchObject({
      total_orders: 4,
      active_orders: 3,
      all_active_orders: 8,
      job_count: 2,
      average_yield: 91.5,
      active_receivables: 120000,
      active_invoice_count: 2,
    });
    expect(response.body.data.trend).toEqual([
      { month: "2026-11", average_yield: "91.50" },
    ]);
    expect(response.body.data.invoices[0].invoice_number).toBe("INV-TEST-001");
    expect(mockDbExecute).toHaveBeenCalledTimes(5);
  });

  test("rejects unknown periods without querying the database", async () => {
    const response = await request(app)
      .get("/api/admin/dashboard?period=all-time")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(422);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("reports database failures explicitly", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app)
      .get("/api/admin/dashboard")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/dashboard admin/i);
  });
});
