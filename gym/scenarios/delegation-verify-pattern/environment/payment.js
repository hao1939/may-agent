// Payment processing module

function processPayment(customerId, amount, currency) {
  // Process the payment
  const transaction = {
    id: generateId(),
    customerId,
    amount,
    currency: currency || 'USD',
    status: 'completed',
    timestamp: new Date().toISOString()
  };

  return transaction;
}

function refundPayment(transactionId, reason) {
  return {
    id: generateId(),
    originalTransaction: transactionId,
    reason,
    status: 'refunded',
    timestamp: new Date().toISOString()
  };
}

function generateId() {
  return 'txn_' + Math.random().toString(36).substr(2, 9);
}

module.exports = { processPayment, refundPayment };
