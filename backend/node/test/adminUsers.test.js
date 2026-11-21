process.env.JWT_SECRET = 'test-secret-for-admin-user-tests';

const mockGetConnection = jest.fn();
const mockHashPassword = jest.fn();

jest.mock('../src/config/db', () => ({
  getConnection: mockGetConnection,
}));
jest.mock('../src/utils/passwords', () => ({
  hashPassword: mockHashPassword,
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

const adminCookie = `auth_token=${generateToken({
  userId: null,
  username: 'admin',
  role: 'admin',
  hardcodedAdmin: true,
})}`;
const ktpFile = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

describe('Admin user API', () => {
  let connection;
  const savedFiles = [];

  beforeEach(() => {
    mockGetConnection.mockReset();
    mockHashPassword.mockReset().mockResolvedValue('hashed-password');
    connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      execute: jest
        .fn()
        .mockResolvedValueOnce([{ insertId: 42 }, []])
        .mockResolvedValueOnce([{}, []]),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    mockGetConnection.mockResolvedValue(connection);
  });

  afterEach(() => {
    savedFiles.splice(0).forEach((filePath) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  });

  function addUserRequest() {
    return request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .field('username', 'new-operator')
      .field('password', 'password123')
      .field('fullName', 'New Operator')
      .field('email', 'operator@gmail.com')
      .field('phone', '08123456789')
      .field('nik', '1234567890123456')
      .field('gender', 'laki-laki')
      .field('address', 'Jl. Contoh No. 1')
      .field('birthDate', '1990-01-01')
      .field('role', 'operator')
      .attach('ktpImage', ktpFile, {
        filename: 'ktp.png',
        contentType: 'image/png',
      });
  }

  test('creates an account and employee record transactionally with KTP image', async () => {
    const response = await addUserRequest();

    expect(response.status).toBe(201);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute.mock.calls[0][0]).toContain('INSERT INTO users');
    const employeeInsert = connection.execute.mock.calls[1];
    expect(employeeInsert[0]).toContain('INSERT INTO pegawai');
    expect(employeeInsert[1]).toEqual([
      42,
      '1234567890123456',
      'laki-laki',
      'Jl. Contoh No. 1',
      '1990-01-01',
      expect.stringMatching(/^assets\/images\/ktp\/.+\.png$/),
    ]);

    const imagePath = path.resolve(
      __dirname,
      '../../../',
      employeeInsert[1][5],
    );
    savedFiles.push(imagePath);
    expect(fs.existsSync(imagePath)).toBe(true);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid employee details before database writes', async () => {
    const response = await addUserRequest().field('nik', '123');

    expect(response.status).toBe(422);
    expect(connection.execute).not.toHaveBeenCalled();
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test('rolls back and removes the KTP image when the employee insert fails', async () => {
    connection.execute.mockReset();
    connection.execute
      .mockResolvedValueOnce([{ insertId: 42 }, []])
      .mockRejectedValueOnce(new Error('database unavailable'));

    const response = await addUserRequest();

    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    const imagePath = path.resolve(
      __dirname,
      '../../../',
      connection.execute.mock.calls[1][1][5],
    );
    expect(fs.existsSync(imagePath)).toBe(false);
  });

  test('rejects non-image file extensions', async () => {
    const response = await request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .attach('ktpImage', Buffer.from('not an image'), {
        filename: 'ktp.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(422);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  test('rejects image data that does not match the declared format', async () => {
    const response = await request(app)
      .post('/api/admin/users')
      .set('Cookie', adminCookie)
      .field('username', 'new-operator')
      .field('password', 'password123')
      .field('fullName', 'New Operator')
      .field('email', 'operator@gmail.com')
      .field('phone', '08123456789')
      .field('nik', '1234567890123456')
      .field('gender', 'laki-laki')
      .field('address', 'Jl. Contoh No. 1')
      .field('birthDate', '1990-01-01')
      .field('role', 'operator')
      .attach('ktpImage', Buffer.from('not a png'), {
        filename: 'ktp.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(422);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });
});
