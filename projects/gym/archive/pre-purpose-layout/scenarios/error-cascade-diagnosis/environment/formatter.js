/**
 * Formats validated records for export.
 * Takes valid records and produces formatted output objects.
 */

function formatRecord(record) {
  const formatted = {
    id: generateId(record.name, record.date),
    display_name: record.name.toUpperCase(),
    amount_cents: `${(record.amount * 100).toFixed(0)}`,
    formatted_amount: `$${record.amount.toFixed(2)}`,
    date: record.date,
    quarter: getQuarter(record.date)
  };

  return formatted;
}

function generateId(name, date) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const dateSlug = date.replace(/-/g, '');
  return `${slug}-${dateSlug}`;
}

function getQuarter(dateStr) {
  const month = parseInt(dateStr.split('-')[1], 10);
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function formatBatch(validatedRecords) {
  const valid = validatedRecords.filter(r => r.valid);
  const invalid = validatedRecords.filter(r => !r.valid);

  return {
    exported: valid.map(r => formatRecord(r.record)),
    rejected: invalid.map(r => ({
      index: r.index,
      errors: r.errors
    })),
    summary: {
      total: validatedRecords.length,
      exported: valid.length,
      rejected: invalid.length
    }
  };
}

module.exports = { formatRecord, formatBatch, getQuarter };
