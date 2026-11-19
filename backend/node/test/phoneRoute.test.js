process.env.JWT_SECRET = 'test-secret-for-phone-route-tests';

const mockDbExecute = jest.fn();
const mockLookupNumber = jest.fn();

jest.mock('../src/config/db', () => ({
  execute: mockDbExecute,
}));
jest.mock('../src/lib/numVerifyLookup', () => ({
  lookupNumber: mockLookupNumber,
}));

const request = require('supertest');
const app = require('../src/app');

describe('Phone validation route', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockLookupNumber.mockReset().mockResolvedValue({
      validFormat: true,
      exists: true,
    });
  });

  test('checks the stored phone number and marks it valid after NumVerify succeeds', async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        [{ phone: '+628123456789', phone_verified: 0 }],
        [],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const response = await request(app)
      .post('/api/phone/validate')
      .send({ userId: 42 });

    expect(response.status).toBe(200);
    expect(response.body.phoneVerified).toBe(true);
    expect(mockLookupNumber).toHaveBeenCalledWith('+628123456789');
    expect(mockDbExecute).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET phone_verified = 1 WHERE id = ? AND role = ? AND phone_verified = 0',
      [42, 'customer'],
    );
    expect(response.body.message).toMatch(/does not prove ownership|tidak membuktikan kepemilikan/i);
  });

  test('does not mark an invalid number as verified', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [{ phone: '+628123456789', phone_verified: 0 }],
      [],
    ]);
    mockLookupNumber.mockResolvedValueOnce({
      validFormat: true,
      exists: false,
    });

    const response = await request(app)
      .post('/api/phone/validate')
      .send({ userId: 42 });

    expect(response.status).toBe(422);
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  test('treats a concurrent successful validation as already completed', async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        [{ phone: '+628123456789', phone_verified: 0 }],
        [],
      ])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([
        [{ phone: '+628123456789', phone_verified: 1 }],
        [],
      ]);

    const response = await request(app)
      .post('/api/phone/validate')
      .send({ userId: 42 });

    expect(response.status).toBe(200);
    expect(response.body.phoneVerified).toBe(true);
    expect(mockDbExecute).toHaveBeenCalledTimes(3);
  });
});
