// src/lib/phoneValidator.js
const { PhoneNumberUtil, PhoneNumberFormat } = require("google-libphonenumber");
const util = PhoneNumberUtil.getInstance();

/**
 * Validate a raw phone string.
 * @param {string} raw                - The user‑entered number (e.g. "415‑555‑2671").
 * @param {string} [defaultRegion='US'] - ISO‑2 country code used when the number has no leading +.
 * @returns {{valid:boolean, e164:string|null, error:string|null}}
 */
function validateNumber(raw, defaultRegion = "ID") {
  try {
    const number = util.parseAndKeepRawInput(raw, defaultRegion);
    const possible = util.isPossibleNumber(number);
    const valid = util.isValidNumber(number);
    if (!possible || !valid) {
      return {
        valid: false,
        e164: null,
        error: "Number fails libphonenumber checks",
      };
    }
    const e164 = util.format(number, PhoneNumberFormat.E164);
    return { valid: true, e164, error: null };
  } catch (e) {
    return { valid: false, e164: null, error: e.message };
  }
}

module.exports = { validateNumber };
