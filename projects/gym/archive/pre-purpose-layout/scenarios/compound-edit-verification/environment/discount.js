/**
 * Discount Engine — applies promotional discounts before tax calculation.
 * 
 * Discounts are applied to the subtotal BEFORE tax. The discount module
 * needs to know the tax rate to provide accurate "you save X" estimates
 * that include the tax savings.
 */

const pricing = require('./pricing');

const PROMOTIONS = {
  'SAVE10': { type: 'percent', value: 10, minSubtotal: 50 },
  'FLAT5':  { type: 'flat',    value: 5,  minSubtotal: 20 },
  'VIP20':  { type: 'percent', value: 20, minSubtotal: 100 },
};

/**
 * Apply a promo code to a set of items.
 * Returns the discount breakdown including tax savings estimate.
 * 
 * @param {Array} items 
 * @param {string} promoCode
 * @returns {{
 *   originalTotal: number,
 *   discountAmount: number,
 *   taxSavings: number,
 *   finalTotal: number,
 *   promoApplied: string|null
 * }}
 */
function applyDiscount(items, promoCode) {
  const original = pricing.calculateTotal(items);
  const promo = PROMOTIONS[promoCode];
  
  if (!promo || original.subtotal < promo.minSubtotal) {
    return {
      originalTotal: original.total,
      discountAmount: 0,
      taxSavings: 0,
      finalTotal: original.total,
      promoApplied: null
    };
  }
  
  let discountAmount;
  if (promo.type === 'percent') {
    discountAmount = Math.round(original.subtotal * promo.value / 100 * 100) / 100;
  } else {
    discountAmount = promo.value;
  }
  
  // Calculate the tax savings from the discount
  // Uses the exported TAX_RATE to compute how much tax the customer saves
  const taxSavings = Math.round(discountAmount * pricing.TAX_RATE * 100) / 100;
  
  // Recalculate with discounted items
  const discountedItems = items.map(item => ({
    ...item,
    price: item.price * (1 - discountAmount / original.subtotal)
  }));
  const discounted = pricing.calculateTotal(discountedItems);
  
  return {
    originalTotal: original.total,
    discountAmount,
    taxSavings,
    finalTotal: discounted.total,
    promoApplied: promoCode
  };
}

/**
 * List available promotions.
 */
function getPromotions() {
  return Object.entries(PROMOTIONS).map(([code, promo]) => ({
    code,
    ...promo,
    description: promo.type === 'percent' 
      ? `${promo.value}% off orders over $${promo.minSubtotal}`
      : `$${promo.value} off orders over $${promo.minSubtotal}`
  }));
}

module.exports = { applyDiscount, getPromotions };
