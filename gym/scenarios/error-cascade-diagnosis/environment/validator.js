/**
 * Validates records against a schema.
 * A record is valid if:
 *   - it has a non-empty 'name' field (string)
 *   - it has an 'amount' field that is a positive number
 *   - it has a 'date' field that matches YYYY-MM-DD format
 */

function validateRecord(record) {
  const errors = [];

  if (!record.name || typeof record.name !== 'string' || record.name.length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  if (typeof record.amount !== 'number' || record.amount <= 0) {
    errors.push('amount must be a positive number');
  }

  if (!record.date || !/^\d{4}\/\d{2}\/\d{2}$/.test(record.date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateBatch(records) {
  return records.map((record, index) => ({
    index,
    record,
    ...validateRecord(record)
  }));
}

module.exports = { validateRecord, validateBatch };
