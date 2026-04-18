// Refund processing module  
// Direct stripe-sdk integration for admin refund operations
//
// WARNING: This module calls createCharge (for refund reversal) directly.
// If the stripe-sdk return format changes, this module ALSO needs updating.

const { createCharge } = require('./stripe-client');

/**
 * Process a refund by creating a reversal charge.
 * Used by admin-refund service only.
 * 
 * NOTE: This duplicates some logic from payment.js intentionally — 
 * refund reversals have different error handling and audit requirements.
 */
async function processRefundReversal(originalChargeId, amount, reason) {
  const auditLog = [];
  
  try {
    const charge = await createCharge({
      customer: `refund_${originalChargeId}`,
      amount,
      currency: 'usd',
    });
    
    // Audit trail uses charge.id directly
    auditLog.push({
      type: 'refund_reversal',
      originalCharge: originalChargeId,
      reversalCharge: charge.id,       // <-- uses v3 field name
      amount: charge.amount,           // <-- uses v3 field name
      reason,
      timestamp: new Date().toISOString(),
    });
    
    // Write to audit DB (simulated)
    console.log(`AUDIT: Refund reversal ${charge.id} for ${charge.amount} cents`);
    
    return { success: true, auditLog };
  } catch (err) {
    auditLog.push({
      type: 'refund_reversal_failed',
      originalCharge: originalChargeId,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
    return { success: false, auditLog };
  }
}

module.exports = { processRefundReversal };
