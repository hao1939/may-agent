// checker.js — Record validator
// BUG: accesses record.value instead of record.amount (the actual CSV column name)
function validate(record, config) {
  const amount = parseFloat(record.value);  // BUG: should be record.amount
  if (isNaN(amount)) {
    return { ...record, valid: false, reason: "non-numeric amount" };
  }
  if (amount > config.threshold) {
    return { ...record, valid: false, reason: "exceeds threshold" };
  }
  return { ...record, valid: true, reason: null };
}

module.exports = { validate };
