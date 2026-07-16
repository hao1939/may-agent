const { formatDiscount } = require('../src/formatter');

describe('formatDiscount', () => {
  test('formatDiscount returns price-formatted value', () => {
    // formatDiscount(0.15) should return "$0.15"
    // This depends on formatPrice returning "$X.XX" format
    expect(formatDiscount(0.15)).toBe('$0.15');
  });

  test('formatDiscount handles small values', () => {
    expect(formatDiscount(0.01)).toBe('$0.01');
  });
});
