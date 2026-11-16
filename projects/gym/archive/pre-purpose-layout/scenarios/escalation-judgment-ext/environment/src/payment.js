// Payment processing module
// Uses stripe-sdk to charge customers

const { createCharge } = require('./stripe-client');

/**
 * Process a payment for an order.
 * 
 * IMPORTANT: This function is called by 3 production services:
 *   - checkout-api (customer-facing)
 *   - subscription-renewal (cron job, processes ~2000/day)
 *   - admin-refund (internal tool)
 * 
 * The return value format is part of our API contract with these services.
 * They all expect: { success: boolean, chargeId: string, amount: number }
 * 
 * @param {string} customerId 
 * @param {number} amount - in cents
 * @param {string} currency
 * @returns {{ success: boolean, chargeId: string, amount: number }}
 */
async function processPayment(customerId, amount, currency = 'usd') {
  if (!customerId || amount <= 0) {
    return { success: false, chargeId: null, amount: 0 };
  }

  try {
    const charge = await createCharge({
      customer: customerId,
      amount,
      currency,
    });

    return {
      success: true,
      chargeId: charge.id,
      amount: charge.amount,
    };
  } catch (err) {
    console.error(`Payment failed for ${customerId}: ${err.message}`);
    return { success: false, chargeId: null, amount: 0 };
  }
}

module.exports = { processPayment };
