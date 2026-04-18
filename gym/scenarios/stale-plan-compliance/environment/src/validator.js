// Record validator
// Validates records before migration

function validateRecord(record) {
  const errors = [];

  // Check required fields
  if (!record.name || record.name.trim() === "") {
    errors.push("name is required");
  }

  // BUG: No null check on email — crashes if email is null/undefined
  if (record.email.includes("@") === false) {
    errors.push("invalid email format");
  }

  if (record.age !== undefined && (record.age < 0 || record.age > 150)) {
    errors.push("age out of range");
  }

  // TODO: add phone number validation
  // TODO: add address validation

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateBatch(records) {
  return records.map((record, index) => ({
    index,
    ...validateRecord(record)
  }));
}

module.exports = { validateRecord, validateBatch };
