/**
 * Output stage — formats transformed records into final JSON.
 */

function formatOutput(records) {
  return records.map(record => ({
    id: record.id,
    name: record.name,
    status: record.valid ? 'valid' : 'invalid',
    label: record.label,
    priority: record.priority,
    score: record.score
  }));
}

module.exports = { formatOutput };
