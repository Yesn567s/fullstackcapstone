const fetch = require('node-fetch');
const { validateNumber } = require('./phoneValidator');

const cache = new Map();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function createNumVerifyError(message, code = 'NUMVERIFY_PROVIDER_ERROR') {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function lookupNumber(rawNumber) {
  const { valid, e164, error } = validateNumber(
    rawNumber,
    process.env.PHONE_DEFAULT_REGION || 'ID',
  );
  if (!valid) {
    return { validFormat: false, exists: false, error };
  }

  const accessKey = process.env.NUMVERIFY_KEY;
  if (!accessKey) {
    throw createNumVerifyError(
      'NumVerify is not configured.',
      'NUMVERIFY_NOT_CONFIGURED',
    );
  }

  const cached = cache.get(e164);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, fromCache: true };
  }
  if (cached) cache.delete(e164);

  const url = new URL('https://apilayer.net/api/validate');
  url.searchParams.set('access_key', accessKey);
  url.searchParams.set('number', e164);

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
  } catch {
    throw createNumVerifyError('NumVerify request failed.');
  }

  if (!response.ok) {
    throw createNumVerifyError(`NumVerify HTTP ${response.status}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw createNumVerifyError('NumVerify returned an invalid response.');
  }

  if (!data || typeof data !== 'object') {
    throw createNumVerifyError('NumVerify returned an invalid response.');
  }
  if (data.success === false || data.error) {
    throw createNumVerifyError(
      'NumVerify rejected the lookup request.',
      'NUMVERIFY_PROVIDER_ERROR',
    );
  }

  const result = {
    validFormat: true,
    exists: data.valid === true,
    carrier: data.carrier || null,
    line_type: data.line_type || null,
    location: data.location || null,
    error: data.valid === true ? null : 'Number not assigned',
  };

  cache.set(e164, {
    result,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });

  return result;
}

module.exports = { lookupNumber };
