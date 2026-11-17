process.env.JWT_SECRET = 'test-secret-for-auth-route-tests';

const request = require('supertest');
const app = require('../src/app');

describe('Authentication API', () => {
  test('exposes a health check', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('allows the configured frontend to make credentialed requests', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:5500')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:5500',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('rejects public registration for staff roles', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullname: 'Admin Example',
      username: 'admin-example',
      email: 'admin@example.com',
      phone: '08123456789',
      role: 'admin',
      password: 'password123',
      companyName: 'Example Company',
      contactPerson: 'Admin Example',
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  test('requires a valid portal on login', async () => {
    const response = await request(app).post('/api/auth/login').send({
      username: 'customer',
      password: 'password123',
      portal: 'admin',
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  test('protects the profile endpoint', async () => {
    const response = await request(app).get('/api/auth/profile');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('protects admin user management', async () => {
    const response = await request(app).get('/api/admin/users');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
