/**
 * Validation stage — checks records and tags them valid/invalid.
 */

const { THRESHOLD } = require('./config');

function validateRecords(records) {
  return records.map(record => ({
    ...record,
    valid: record.score < THRESHOLD,
    _stage: 'validated'
  }));
}

module.exports = { validateRecords };
