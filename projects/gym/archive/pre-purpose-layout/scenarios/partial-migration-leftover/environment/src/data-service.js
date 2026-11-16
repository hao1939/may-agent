/**
 * Data Service Module
 *
 * Provides functions to fetch, process, and display data records.
 * Recently migrated from callbacks to async/await.
 */

const { formatRecord, formatRecords, formatCurrency } = require('./formatter');

// In-memory data store (simulates a database)
const RECORDS = [
  { id: 'rec_001', userId: 'usr_001', status: 'active', amount: 150.00, createdAt: 1705312800000 },   // 2024-01-15
  { id: 'rec_002', userId: 'usr_002', status: 'pending', amount: 75.50, createdAt: 1707991200000 },    // 2024-02-15
  { id: 'rec_003', userId: 'usr_001', status: 'inactive', amount: 200.00, createdAt: 1710669600000 },  // 2024-03-17
  { id: 'rec_004', userId: 'usr_003', status: 'active', amount: 50.25, createdAt: 1713348000000 },     // 2024-04-17
  { id: 'rec_005', userId: 'usr_004', status: 'suspended', amount: 300.00, createdAt: 1716026400000 }, // 2024-05-18
];

/**
 * Fetch a record by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getRecord(id) {
  return RECORDS.find(r => r.id === id) || null;
}

/**
 * Fetch records by user ID.
 * @param {string} userId
 * @returns {object[]}
 */
function getRecordsByUser(userId) {
  return RECORDS.filter(r => r.userId === userId);
}

/**
 * Fetch and format a single record for display.
 * 
 * NOTE: This was migrated from sync to use the new async formatter,
 * but the migration wasn't completed properly.
 *
 * @param {string} id - Record ID
 * @returns {string|null} Formatted record string, or null if not found
 */
function fetchAndFormat(id) {
  const record = getRecord(id);
  if (!record) {
    return null;
  }
  const formatted = formatRecord(record);
  return `Record: ${formatted}`;
}

/**
 * Fetch and format all records for a user.
 * This function WAS properly migrated to async/await.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function fetchAndFormatByUser(userId) {
  const records = getRecordsByUser(userId);
  if (records.length === 0) {
    return [];
  }
  const formatted = await formatRecords(records);
  return formatted.map(f => `Record: ${f}`);
}

/**
 * Get a summary of all records.
 * @returns {object} { totalRecords, totalAmount, formattedTotal }
 */
function getSummary() {
  const totalAmount = RECORDS.reduce((sum, r) => sum + r.amount, 0);
  return {
    totalRecords: RECORDS.length,
    totalAmount,
    formattedTotal: formatCurrency(totalAmount),
  };
}

module.exports = {
  getRecord,
  getRecordsByUser,
  fetchAndFormat,
  fetchAndFormatByUser,
  getSummary,
};
