process.env.JWT_SECRET = 'test-secret-for-auth-controller';

const mockGetConnection = jest.fn();
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
const mockClearAuthCookie = jest.fn();
const mockGenerateToken = jest.fn();
const mockSetAuthCookie = jest.fn();
const mockSendVerificationEmailForUser = jest.fn();
const mockValidatePhoneNumber = jest.fn();

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
jest.mock('../src/lib/phoneValidator', () => ({
  validateNumber: mockValidatePhoneNumber,
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
    mockValidatePhoneNumber.mockReturnValue({
      valid: true,
      e164: '+628123456789',
    });
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
    expect(connection.execute.mock.calls[0][1]).toEqual([
      'customer-example',
      'hashed-password',
      'Customer Example',
      'customer@gmail.com',
      '+628123456789',
      'customer',
    ]);
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

  test('rejects invalid phone formats before creating an account', async () => {
    mockValidatePhoneNumber.mockReturnValueOnce({
      valid: false,
      e164: null,
    });
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

    expect(mockGetConnection).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(422);
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

    expect(mockSendVerificationEmailForUser).toHaveBeenCalledWith(
      42,
      'customer@gmail.com',
    );
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        verificationRequired: true,
        userId: 42,
      }),
    );
    expect(connection.release).toHaveBeenCalled();
  });

  test('blocks customers with verified email but unverified phone', async () => {
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

    expect(mockSendVerificationEmailForUser).not.toHaveBeenCalled();
    expect(mockSetAuthCookie).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ verificationRequired: true, userId: 42 }),
    );
  });

  test('allows customers to log in after both verifications are complete', async () => {
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
    mockGenerateToken.mockReturnValue('session-token');
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

    expect(mockSetAuthCookie).toHaveBeenCalledWith(response, 'session-token');
  });
});
