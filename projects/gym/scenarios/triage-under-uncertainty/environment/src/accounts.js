/**
 * Account balance management.
 * Handles deposits, withdrawals, and balance checks.
 * 
 * BUG-102: Under concurrent transactions, balance can go negative.
 * 
 * The issue is that getBalance + withdraw is not atomic — two concurrent
 * withdrawals can both read the same balance before either writes.
 */

// In-memory store (simulating a database)
const accounts = new Map();

function createAccount(id, initialBalance = 0) {
  if (accounts.has(id)) throw new Error(`Account ${id} already exists`);
  if (initialBalance < 0) throw new Error('Initial balance cannot be negative');
  
  accounts.set(id, {
    id,
    balance: initialBalance,
    transactions: []
  });
  
  return { id, balance: initialBalance };
}

function getBalance(id) {
  const account = accounts.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  return account.balance;
}

function deposit(id, amount) {
  if (amount <= 0) throw new Error('Deposit amount must be positive');
  const account = accounts.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  
  account.balance += amount;
  account.transactions.push({
    type: 'deposit',
    amount,
    timestamp: Date.now(),
    balanceAfter: account.balance
  });
  
  return { balance: account.balance };
}

function withdraw(id, amount) {
  if (amount <= 0) throw new Error('Withdrawal amount must be positive');
  const account = accounts.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  
  // BUG: This check-then-act is not atomic.
  // In concurrent scenarios, two withdrawals can both pass this check
  // before either one modifies the balance.
  const currentBalance = account.balance;
  
  if (currentBalance < amount) {
    throw new Error(`Insufficient funds: have ${currentBalance}, need ${amount}`);
  }
  
  // Simulate async delay (representing DB write latency)
  // In production, this gap between check and update is where the race happens
  account.balance = currentBalance - amount;
  account.transactions.push({
    type: 'withdrawal',
    amount,
    timestamp: Date.now(),
    balanceAfter: account.balance
  });
  
  return { balance: account.balance };
}

/**
 * Async version that exposes the race condition more clearly.
 * The delay between balance check and update allows concurrent operations
 * to interleave dangerously.
 */
async function withdrawAsync(id, amount) {
  if (amount <= 0) throw new Error('Withdrawal amount must be positive');
  const account = accounts.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  
  const currentBalance = account.balance;
  
  if (currentBalance < amount) {
    throw new Error(`Insufficient funds: have ${currentBalance}, need ${amount}`);
  }
  
  // Simulate DB write latency — this is where concurrent reads can interleave
  await new Promise(resolve => setTimeout(resolve, 10));
  
  account.balance = currentBalance - amount;
  account.transactions.push({
    type: 'withdrawal',
    amount,
    timestamp: Date.now(),
    balanceAfter: account.balance
  });
  
  return { balance: account.balance };
}

function getTransactions(id) {
  const account = accounts.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  return [...account.transactions];
}

function resetAccounts() {
  accounts.clear();
}

module.exports = { 
  createAccount, getBalance, deposit, withdraw, withdrawAsync, 
  getTransactions, resetAccounts 
};
