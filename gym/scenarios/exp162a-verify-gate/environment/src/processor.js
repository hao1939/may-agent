/**
 * Data Processor Module
 * Reads a list of records, filters invalid ones, and returns summary stats.
 */

function processRecords(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("Expected an array of records");
  }

  const valid = records.filter(r => {
    return r && typeof r.id === "number" && typeof r.value === "string";
  });

  // BUG: 'reduce' called on potentially empty array without initial value,
  // and accessing .value.length on items that may not exist
  const totalLength = valid.reduce((sum, r) => sum + r.value.lenght);

  return {
    total: records.length,
    valid: valid.length,
    invalid: records.length - valid.length,
    totalValueLength: totalLength,
  };
}

function formatReport(stats) {
  return [
    `Total records: ${stats.total}`,
    `Valid: ${stats.valid}`,
    `Invalid: ${stats.invalid}`,
    `Total value length: ${stats.totalValueLength}`,
  ].join("\n");
}

module.exports = { processRecords, formatReport };
