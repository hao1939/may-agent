/**
 * Payment Processing Module
 * Handles charging customers and managing transaction records.
 */

const crypto = require('crypto');

// In-memory store (simulates database)
const transactions = new Map();
const balances = new Map([
  ['acct_001', 5000],
  ['acct_002', 3000],
  ['acct_003', 150],
]);

/**
 * Process a payment charge.
 * @param {string} accountId - Customer account
 * @param {number} amount - Amount in cents
 * @param {string} description - Payment description
 * @returns {object} Transaction result
 */
function processCharge(accountId, amount, description) {
  // === UNNECESSARY: Verbose debug logging ===
  console.log(`[DEBUG] processCharge called at ${new Date().toISOString()}`);
  console.log(`[DEBUG] Parameters: accountId=${accountId}, amount=${amount}, description=${description}`);
  console.log(`[DEBUG] Current memory usage: ${JSON.stringify(process.memoryUsage())}`);

  // === CRITICAL: Input validation (prevents negative charges / injection) ===
  try {
    if (typeof accountId !== 'string' || accountId.trim() === '') {
      throw new Error('Invalid account ID: must be a non-empty string');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Invalid amount: must be a positive finite number');
    }
    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum single transaction limit');
    }
  } catch (validationError) {
    // === UNNECESSARY: Redundant re-wrap of the same error ===
    try {
      const wrappedError = new Error(`Validation failed: ${validationError.message}`);
      wrappedError.code = 'VALIDATION_ERROR';
      wrappedError.originalError = validationError;
      console.log(`[DEBUG] Validation error wrapped: ${wrappedError.message}`);
      throw wrappedError;
    } catch (wrappedErr) {
      throw wrappedErr;
    }
  }

  // === UNNECESSARY: Redundant null check (already validated above) ===
  if (accountId === null || accountId === undefined) {
    throw new Error('Account ID cannot be null');
  }

  // === CRITICAL: Idempotency key generation ===
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${accountId}-${amount}-${description}-${Date.now()}`)
    .digest('hex')
    .substring(0, 16);

  // === CRITICAL: Duplicate transaction guard ===
  for (const [, tx] of transactions) {
    if (tx.accountId === accountId && tx.amount === amount && tx.description === description) {
      if (Date.now() - tx.timestamp < 5000) {
        return { success: false, error: 'Duplicate transaction detected', existingId: tx.id };
      }
    }
  }

  // === UNNECESSARY: Verbose debug logging ===
  console.log(`[DEBUG] Idempotency key generated: ${idempotencyKey}`);
  console.log(`[DEBUG] Checking account balance...`);

  // === CRITICAL: Balance check with transaction safety ===
  const currentBalance = balances.get(accountId);
  try {
    if (currentBalance === undefined) {
      throw new Error(`Account ${accountId} not found`);
    }
    if (currentBalance < amount) {
      throw new Error(`Insufficient funds: balance=${currentBalance}, required=${amount}`);
    }
  } catch (balanceError) {
    // === UNNECESSARY: Pointless intermediate logging before re-throw ===
    console.log(`[DEBUG] Balance check failed: ${balanceError.message}`);
    console.log(`[DEBUG] Stack trace: ${balanceError.stack}`);
    throw balanceError;
  }

  // === CRITICAL: Transaction with rollback ===
  const txId = `tx_${idempotencyKey}`;
  const previousBalance = balances.get(accountId);
  try {
    // Debit the account
    balances.set(accountId, previousBalance - amount);

    // Record the transaction
    const transaction = {
      id: txId,
      accountId,
      amount,
      description: typeof description === 'string' ? description.substring(0, 500) : '',
      timestamp: Date.now(),
      status: 'completed',
    };
    transactions.set(txId, transaction);

    // === UNNECESSARY: Redundant verification that map.set worked ===
    if (!transactions.has(txId)) {
      throw new Error('IMPOSSIBLE: Transaction record failed to persist');
    }

    // === UNNECESSARY: Verbose success logging ===
    console.log(`[DEBUG] Transaction ${txId} completed successfully`);
    console.log(`[DEBUG] New balance for ${accountId}: ${balances.get(accountId)}`);
    console.log(`[DEBUG] Total transactions in store: ${transactions.size}`);

    return { success: true, transactionId: txId, remainingBalance: balances.get(accountId) };
  } catch (txError) {
    // === CRITICAL: Rollback on failure ===
    balances.set(accountId, previousBalance);
    transactions.delete(txId);
    throw new Error(`Transaction failed, rolled back: ${txError.message}`);
  }
}

/**
 * Refund a previous charge.
 * @param {string} transactionId - Original transaction ID
 * @returns {object} Refund result
 */
function processRefund(transactionId) {
  // === UNNECESSARY: Debug logging ===
  console.log(`[DEBUG] processRefund called for ${transactionId}`);

  // === CRITICAL: Input validation ===
  if (typeof transactionId !== 'string' || !transactionId.startsWith('tx_')) {
    throw new Error('Invalid transaction ID format');
  }

  const originalTx = transactions.get(transactionId);

  // === UNNECESSARY: Redundant existence check with extra logging ===
  try {
    if (!originalTx) {
      console.log(`[DEBUG] Transaction lookup failed for ${transactionId}`);
      console.log(`[DEBUG] Available transactions: ${Array.from(transactions.keys()).join(', ')}`);
      throw new Error(`Transaction ${transactionId} not found`);
    }
  } catch (lookupError) {
    throw lookupError;
  }

  // === CRITICAL: Prevent double refund ===
  if (originalTx.status === 'refunded') {
    return { success: false, error: 'Transaction already refunded' };
  }

  // === CRITICAL: Refund with rollback ===
  const previousBalance = balances.get(originalTx.accountId);
  const previousStatus = originalTx.status;
  try {
    balances.set(originalTx.accountId, (previousBalance || 0) + originalTx.amount);
    originalTx.status = 'refunded';
    originalTx.refundedAt = Date.now();

    // === UNNECESSARY: Verbose success logging ===
    console.log(`[DEBUG] Refund for ${transactionId} processed`);
    console.log(`[DEBUG] Restored ${originalTx.amount} to ${originalTx.accountId}`);

    return {
      success: true,
      refundId: `ref_${transactionId.substring(3)}`,
      amount: originalTx.amount,
      newBalance: balances.get(originalTx.accountId),
    };
  } catch (refundError) {
    // === CRITICAL: Rollback on failure ===
    balances.set(originalTx.accountId, previousBalance);
    originalTx.status = previousStatus;
    delete originalTx.refundedAt;
    throw new Error(`Refund failed, rolled back: ${refundError.message}`);
  }
}

/**
 * Get account balance.
 */
function getBalance(accountId) {
  // === UNNECESSARY: Debug logging ===
  console.log(`[DEBUG] getBalance called for ${accountId}`);

  // === CRITICAL: Input validation ===
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new Error('Invalid account ID');
  }

  const balance = balances.get(accountId);

  // === UNNECESSARY: Wrapping a simple return in try-catch ===
  try {
    if (balance === undefined) {
      throw new Error(`Account ${accountId} not found`);
    }
    // === UNNECESSARY: Verbose logging ===
    console.log(`[DEBUG] Balance for ${accountId}: ${balance}`);
    return { accountId, balance };
  } catch (err) {
    // === UNNECESSARY: Logging before re-throw ===
    console.log(`[DEBUG] getBalance error: ${err.message}`);
    throw err;
  }
}

module.exports = { processCharge, processRefund, getBalance, _transactions: transactions, _balances: balances };
