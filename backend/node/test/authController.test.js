process.env.JWT_SECRET = 'test-secret-for-auth-controller';

const mockGetConnection = jest.fn();
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
const mockClearAuthCookie = jest.fn();
const mockGenerateToken = jest.fn();
const mockSetAuthCookie = jest.fn();
const mockSendVerificationEmailForUser = jest.fn();

jest.mock('../src/config/db', () => ({
  getConnection: mockGetConnection,
}));
jest.mock('../src/utils/passwords', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));
jest.mock('../src/middleware/auth', () => ({
  clearAuthCookie: mockClearAuthCookie,
  generateToken: mockGenerateToken,
  setAuthCookie: mockSetAuthCookie,
}));
jest.mock('../src/services/emailVerification', () => ({
  sendVerificationEmailForUser: mockSendVerificationEmailForUser,
}));

const { register, login } = require('../src/controllers/authController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Authentication controller email verification', () => {
  let connection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHashPassword.mockResolvedValue('hashed-password');
    mockVerifyPassword.mockResolvedValue(true);
    mockSendVerificationEmailForUser.mockResolvedValue();
    connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      execute: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    mockGetConnection.mockResolvedValue(connection);
  });

  test('sends verification after committing a new customer registration', async () => {
    connection.execute
      .mockResolvedValueOnce([{ insertId: 42 }, []])
      .mockResolvedValueOnce([{}, []]);
    const response = createResponse();

    await register(
      {
        body: {
          fullname: 'Customer Example',
          username: 'customer-example',
          email: 'customer@gmail.com',
          phone: '08123456789',
          password: 'password123',
          companyName: 'Example Company',
          contactPerson: 'Customer Example',
          address: 'Example Street',
        },
      },
      response,
    );

    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
    expect(mockSendVerificationEmailForUser).toHaveBeenCalledWith(
      42,
      'customer@gmail.com',
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        verificationEmailSent: true,
      }),
    );
  });

  test('resends verification and denies login for an unverified customer', async () => {
    connection.execute.mockResolvedValueOnce([
      [
        {
          id: 42,
          username: 'customer-example',
          password_hash: 'hashed-password',
          role: 'customer',
          email: 'customer@gmail.com',
          email_verified: 0,
        },
      ],
      [],
    ]);
    const response = createResponse();

    await login(
      {
        body: {
          username: 'customer-example',
          password: 'password123',
          portal: 'customer',
        },
      },
      response,
    );

    expect(mockSendVerificationEmailForUser).toHaveBeenCalledWith(
      42,
      'customer@gmail.com',
    );
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(connection.release).toHaveBeenCalled();
  });

  test('denies customer login until the phone number is checked', async () => {
    connection.execute.mockResolvedValueOnce([
      [
        {
          id: 42,
          username: 'customer-example',
          password_hash: 'hashed-password',
          role: 'customer',
          email: 'customer@gmail.com',
          email_verified: 1,
          phone_verified: 0,
        },
      ],
      [],
    ]);
    const response = createResponse();

    await login(
      {
        body: {
          username: 'customer-example',
          password: 'password123',
          portal: 'customer',
        },
      },
      response,
    );

    expect(mockClearAuthCookie).toHaveBeenCalledWith(response);
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      activationRequired: true,
      userId: 42,
      message:
        'Nomor telepon belum diperiksa. Silakan lanjutkan pemeriksaan melalui halaman aktivasi akun sebelum masuk.',
    });
    expect(connection.release).toHaveBeenCalled();
  });

  test('allows customer login after email and phone verification', async () => {
    mockGenerateToken.mockReturnValueOnce('customer-token');
    connection.execute.mockResolvedValueOnce([
      [
        {
          id: 42,
          username: 'customer-example',
          password_hash: 'hashed-password',
          role: 'customer',
          email: 'customer@gmail.com',
          email_verified: 1,
          phone_verified: 1,
        },
      ],
      [],
    ]);
    const response = createResponse();

    await login(
      {
        body: {
          username: 'customer-example',
          password: 'password123',
          portal: 'customer',
        },
      },
      response,
    );

    expect(mockSetAuthCookie).toHaveBeenCalledWith(
      response,
      'customer-token',
    );
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      user: { username: 'customer-example', role: 'customer' },
    });
  });

  test('allows the hardcoded admin login without querying the database', async () => {
    const response = createResponse();

    await login(
      {
        body: {
          username: 'admin',
          password: 'admin123',
          portal: 'staff',
        },
      },
      response,
    );

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockGenerateToken).toHaveBeenCalledWith({
      userId: null,
      username: 'admin',
      role: 'admin',
      hardcodedAdmin: true,
    });
    expect(mockSetAuthCookie).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      user: { username: 'admin', role: 'admin' },
    });
  });

  test('rejects a wrong password for the hardcoded admin before database access', async () => {
    const response = createResponse();

    await login(
      {
        body: {
          username: 'admin',
          password: 'wrong-password',
          portal: 'staff',
        },
      },
      response,
    );

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(mockClearAuthCookie).toHaveBeenCalledWith(response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
  });

  test('does not allow a database admin account through the staff portal', async () => {
    connection.execute.mockResolvedValueOnce([
      [
        {
          id: 7,
          username: 'demo_admin',
          password_hash: 'hashed-password',
          role: 'admin',
          email: 'admin@example.com',
          email_verified: 1,
        },
      ],
      [],
    ]);
    const response = createResponse();

    await login(
      {
        body: {
          username: 'demo_admin',
          password: 'password123',
          portal: 'staff',
        },
      },
      response,
    );

    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });
});
