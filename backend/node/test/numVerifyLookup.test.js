const mockFetch = jest.fn();

jest.mock('node-fetch', () => mockFetch);

const { lookupNumber } = require('../src/lib/numVerifyLookup');

describe('NumVerify lookup', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NUMVERIFY_KEY = 'test-key';
    process.env.PHONE_DEFAULT_REGION = 'ID';
  });

  test('does not make a provider request for an invalid phone format', async () => {
    await expect(lookupNumber('not-a-phone')).resolves.toMatchObject({
      validFormat: false,
      exists: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('validates and caches a valid number lookup', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        carrier: 'Example Carrier',
        line_type: 'mobile',
      }),
    });

    await expect(lookupNumber('+628123456789')).resolves.toMatchObject({
      validFormat: true,
      exists: true,
      carrier: 'Example Carrier',
    });
    await expect(lookupNumber('+628123456789')).resolves.toMatchObject({
      exists: true,
      fromCache: true,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toMatch(/^https:\/\/apilayer\.net\//);
  });

  test('surfaces missing provider configuration', async () => {
    delete process.env.NUMVERIFY_KEY;

    await expect(lookupNumber('+628123456789')).rejects.toMatchObject({
      code: 'NUMVERIFY_NOT_CONFIGURED',
    });
  });

  test('surfaces provider and network failures', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(lookupNumber('+628223456789')).rejects.toMatchObject({
      code: 'NUMVERIFY_PROVIDER_ERROR',
    });

    mockFetch.mockRejectedValueOnce(new Error('network failure'));
    await expect(lookupNumber('+628323456789')).rejects.toMatchObject({
      code: 'NUMVERIFY_PROVIDER_ERROR',
    });
  });
});
