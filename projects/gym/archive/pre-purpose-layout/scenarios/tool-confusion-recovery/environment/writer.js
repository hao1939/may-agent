// writer.js — JSON formatter (NOT a file writer, despite the name)
function formatJson(records) {
  const summary = {
    total: records.length,
    valid: records.filter(r => r.valid).length,
    invalid: records.filter(r => !r.valid).length,
    records: records,
  };
  return JSON.stringify(summary, null, 2);
}

module.exports = { formatJson };
