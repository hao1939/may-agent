// src/validator.js — Validates API response objects have required fields

const REQUIRED_FIELDS = ['user_name', 'created_at', 'is_active', 'account_balance', 'id'];

function validateResponse(response) {
  const missing = REQUIRED_FIELDS.filter(f => !(f in response));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  if (typeof response.is_active !== 'boolean') {
    throw new Error('is_active must be a boolean');
  }
  if (typeof response.account_balance !== 'number') {
    throw new Error('account_balance must be a number');
  }
  return true;
}

module.exports = { validateResponse, REQUIRED_FIELDS };
