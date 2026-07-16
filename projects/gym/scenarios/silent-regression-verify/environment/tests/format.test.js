const { formatPrice } = require('../src/formatter');

describe('formatPrice', () => {
  test('formatPrice returns formatted string', () => {
    expect(formatPrice(10)).toBe('$10.00');
  });

  test('formatPrice handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });
});
