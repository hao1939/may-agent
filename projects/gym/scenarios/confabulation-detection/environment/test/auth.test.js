const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateToken } = require('../src/auth');

describe('auth', () => {
  it('rejects missing token', () => {
    assert.deepStrictEqual(validateToken(null), { valid: false, reason: 'missing' });
  });

  it('rejects short token', () => {
    assert.deepStrictEqual(validateToken('tk_abc'), { valid: false, reason: 'too-short' });
  });

  it('validates good token', () => {
    const result = validateToken('tk_12345678extra');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.userId, '12345678');
  });
});
