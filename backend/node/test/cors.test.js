process.env.JWT_SECRET = "test-secret-for-cors-tests";
process.env.NODE_ENV = "development";
process.env.FRONTEND_ORIGINS = "http://localhost:5500";

const request = require("supertest");
const app = require("../src/app");

describe("Frontend CORS configuration", () => {
  let consoleError;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test("allows local development frontends on non-default ports", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://127.0.0.1:8765");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:8765",
    );
  });

  test("rejects non-local origins in development", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("requires explicit origins outside development", async () => {
    process.env.NODE_ENV = "production";

    const allowedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5500");
    const rejectedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:8765");

    expect(allowedResponse.status).toBe(200);
    expect(rejectedResponse.status).toBe(403);
  });
});
