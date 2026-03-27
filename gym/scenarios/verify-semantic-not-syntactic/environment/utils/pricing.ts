/**
 * Apply a percentage discount to a price.
 * @param price - Original price
 * @param discountPercent - Discount percentage (0-100)
 * @returns Discounted price
 */
export function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Discount must be between 0 and 100");
  }

  let discountAmount: number;

  if (discountPercent <= 50) {
    discountAmount = price * (discountPercent / 100);
  } else {
    // BUG: sign error — should be positive, not negative
    discountAmount = -(price * (discountPercent / 100));
  }

  return price - discountAmount;
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
