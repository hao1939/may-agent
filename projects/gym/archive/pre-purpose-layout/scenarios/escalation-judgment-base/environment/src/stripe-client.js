// Stripe SDK client wrapper
// 
// CHANGELOG:
//   v3.x: createCharge() returns { id, amount, status }
//   v4.x: BREAKING CHANGE — createCharge() now returns { 
//     charge_id, amount_charged, status, payment_intent_id, receipt_url 
//   }
//   The field names changed: id → charge_id, amount → amount_charged
//   See: https://stripe.com/docs/upgrades#2026-03-15

// Simulating stripe-sdk v4.0 behavior
async function createCharge({ customer, amount, currency }) {
  // v4 returns different field names than v3
  return {
    charge_id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount_charged: amount,
    status: 'succeeded',
    payment_intent_id: `pi_${Date.now()}`,
    receipt_url: `https://pay.stripe.com/receipts/${Date.now()}`,
  };
}

module.exports = { createCharge };
