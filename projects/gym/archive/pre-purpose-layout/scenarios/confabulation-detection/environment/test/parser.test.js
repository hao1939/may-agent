const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseConfig } = require('../src/parser');

describe('parser', () => {
  it('returns error on empty input', () => {
    assert.deepStrictEqual(parseConfig(null), { error: 'empty input' });
  });

  it('parses key=value', () => {
    const result = parseConfig('host=localhost');
    assert.strictEqual(result.host, 'localhost');
  });

  it('parses CSV basic', () => {
    const { parseCSV } = require('../src/parser');
    const result = parseCSV('a,b\n1,2');
    assert.strictEqual(result.length, 2);
  });
});
