process.env.EMAIL_HOST = 'smtp.example.test';
process.env.EMAIL_USER = 'verification@example.test';
process.env.EMAIL_PASS = 'test-password';
process.env.FRONTEND_BASE_URL = 'http://localhost:5500/frontend';

const mockSendMail = jest.fn();
const mockDbExecute = jest.fn();
const mockGetConnection = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));
jest.mock('../src/config/db', () => ({
  execute: mockDbExecute,
  getConnection: mockGetConnection,
}));

const db = require('../src/config/db');
const nodemailer = require('nodemailer');
const {
  sendVerificationEmailForUser,
} = require('../src/services/emailVerification');
const {
  getVerificationStatus,
  resendEmailVerification,
  sendEmailVerification,
  verifyEmailLink,
} = require('../src/controllers/verificationController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Email verification', () => {
  beforeEach(() => {
    mockDbExecute.mockReset().mockResolvedValue([{}, []]);
    mockGetConnection.mockReset();
    mockSendMail.mockReset().mockResolvedValue({ messageId: 'test-message' });
  });

  test('stores a token and sends a link to the frontend verification page', async () => {
    await sendVerificationEmailForUser(42, 'person@gmail.com');

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'verification@example.test',
        pass: 'test-password',
      },
    });

    const [query, values] = mockDbExecute.mock.calls[0];
    expect(query).toContain('INSERT INTO email_verification_tokens');
    expect(values[0]).toBe(42);
    expect(values[1]).toMatch(/^[a-f0-9]{64}$/);

    const mail = mockSendMail.mock.calls[0][0];
    const link = new URL(mail.html.match(/href="([^"]+)"/)[1]);
    expect(mail.to).toBe('person@gmail.com');
    expect(link.origin).toBe('http://localhost:5500');
    expect(link.pathname).toBe('/frontend/template/verify.html');
    expect(link.searchParams.get('uid')).toBe('42');
    expect(link.searchParams.get('t')).toBe(values[1]);
    expect(mail.html).toContain('Click the button to verify your email.');
    expect(mail.html).toContain('>Click me</a>');
    expect(mail.text).toContain('Click the button to verify your email.');
  });

  test('loads the email using the authenticated userId before resending', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [{ email: 'person@gmail.com', email_verified: 0 }],
      [],
    ]);
    const response = createResponse();

    await sendEmailVerification({ user: { userId: 42 } }, response);

    expect(mockDbExecute.mock.calls[0][1]).toEqual([42]);
    expect(mockSendMail.mock.calls[0][0].to).toBe('person@gmail.com');
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: 'Email verifikasi telah dikirim.',
    });
  });

  test('returns only the verification flags for the registration status page', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [{ email_verified: 1, phone_verified: 0 }],
      [],
    ]);
    const response = createResponse();

    await getVerificationStatus({ query: { userId: '42' } }, response);

    expect(response.json).toHaveBeenCalledWith({
      success: true,
      emailVerified: true,
      phoneVerified: false,
    });
  });

  test('allows an unverified customer to resend email from the status page', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [{ email: 'person@gmail.com', email_verified: 0 }],
      [],
    ]);
    const response = createResponse();

    await resendEmailVerification({ body: { userId: 42 } }, response);

    expect(mockSendMail).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      message: 'Email verifikasi telah dikirim.',
    });
  });

  test('marks a valid token verified and consumes it once', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      execute: jest
        .fn()
        .mockResolvedValueOnce([[{ id: 8 }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
    };
    mockGetConnection.mockResolvedValue(connection);
    const response = createResponse();
    const token = 'a'.repeat(64);

    await verifyEmailLink({ query: { uid: '42', t: token } }, response);

    expect(connection.execute).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET email_verified = 1 WHERE id = ?',
      ['42'],
    );
    expect(connection.execute).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM email_verification_tokens WHERE id = ?',
      [8],
    );
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      userId: 42,
      message:
        'Alamat email berhasil diverifikasi. Silakan lanjutkan verifikasi nomor telepon.',
    });
  });

  test('rejects malformed links before accessing the database', async () => {
    const response = createResponse();

    await verifyEmailLink({ query: { uid: 'not-an-id', t: 'bad-token' } }, response);

    expect(db.getConnection).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
