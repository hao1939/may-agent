/**
 * transformer.js — Transforms validated records
 * 
 * For each record:
 * - Converts amount to number
 * - Calculates lineTotal = amount * quantity
 * - Applies category discount
 * - Adds tax (8.5%)
 */

const CATEGORY_DISCOUNTS = {
  electronics: 0.05,   // 5% discount
  clothing: 0.10,      // 10% discount
  food: 0.00,          // no discount
  books: 0.15          // 15% discount
};

const TAX_RATE = 0.085;

function transformRecords(records) {
  return records.map(record => {
    const amount = parseInt(record.amount);
    const quantity = record.quantity;
    
    const lineTotal = amount * quantity;
    const discount = CATEGORY_DISCOUNTS[record.category] || 0;
    const discountedTotal = lineTotal * (1 - discount);
    const tax = discountedTotal * TAX_RATE;
    const finalTotal = discountedTotal + tax;

    return {
      id: record.id,
      name: record.name,
      category: record.category,
      amount: amount,
      quantity: quantity,
      lineTotal: lineTotal,
      discount: discount,
      discountedTotal: Math.round(discountedTotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100
    };
  });
}

module.exports = { transformRecords };
