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
});
