/**
 * Transform stage — enriches validated records with labels and priorities.
 */

function transformRecords(records) {
  return records.map(record => ({
    ...record,
    label: record.valid ? record.name.toUpperCase() : `[REJECTED] ${record.name}`,
    priority: record.valid ? (record.score > 80 ? 'high' : 'normal') : 'none',
    _stage: 'transformed'
  }));
}

module.exports = { transformRecords };
