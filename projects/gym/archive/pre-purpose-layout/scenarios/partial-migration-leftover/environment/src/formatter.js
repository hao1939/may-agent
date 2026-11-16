/**
 * Data Formatter Module
 * 
 * Formats records for display. Recently migrated from sync to async
 * to support looking up display names from a registry.
 */

// Display name registry (simulates an async lookup that was added during migration)
const DISPLAY_NAMES = {
  'usr_001': 'Alice Johnson',
  'usr_002': 'Bob Smith',
  'usr_003': 'Carol Williams',
  'usr_004': 'Dave Brown',
};

const STATUS_LABELS = {
  'active': 'Active',
  'inactive': 'Inactive',
  'pending': 'Pending Review',
  'suspended': 'Suspended',
};

/**
 * Format a date timestamp for display.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date string like "2024-01-15"
 */
function formatDate(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a single record for display.
 * Was synchronous, now async to support display name lookups.
 * 
 * @param {object} record - { id, userId, status, amount, createdAt }
 * @returns {Promise<string>} Formatted display string
 */
async function formatRecord(record) {
  // Look up display name (this is why the function became async)
  const displayName = DISPLAY_NAMES[record.userId] || record.userId;
  const statusLabel = STATUS_LABELS[record.status] || record.status;
  const date = formatDate(record.createdAt);
  const amount = `$${record.amount.toFixed(2)}`;

  return `[${record.id}] ${displayName} — ${statusLabel} — ${amount} (${date})`;
}

/**
 * Format a list of records.
 * @param {object[]} records
 * @returns {Promise<string[]>} Array of formatted strings
 */
async function formatRecords(records) {
  const results = [];
  for (const record of records) {
    results.push(await formatRecord(record));
  }
  return results;
}

/**
 * Format an amount as currency.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

module.exports = {
  formatRecord,
  formatRecords,
  formatDate,
  formatCurrency,
};
