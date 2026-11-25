process.env.JWT_SECRET = "test-secret-for-production-monitoring-tests";

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

describe("Production monitoring API", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
  });

  test("requires an authenticated staff session", async () => {
    const response = await request(app).get("/api/admin/production");

    expect(response.status).toBe(401);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  test("returns production jobs and database summaries", async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        [
          {
            id: 8,
            job_number: "CJ-TEST-008",
            status: "in_progress",
            po_number: "BUYER-PO-008",
            material_name: "LVB Poplar",
            operator_name: "operator-test",
            total_order_units: 250,
            yield_rate_percent: "72.50",
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            active_orders: 2,
            active_jobs: 3,
            passed_qc_units: 120,
          },
        ],
        [],
      ]);

    const response = await request(app)
      .get("/api/admin/production")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      job_number: "CJ-TEST-008",
      status: "in_progress",
      total_order_units: 250,
    });
    expect(response.body.summary).toMatchObject({
      active_orders: 2,
      active_jobs: 3,
      passed_qc_units: 120,
    });
  });

  test("reports database failures explicitly", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app)
      .get("/api/admin/production")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/monitoring produksi/i);
  });
});
