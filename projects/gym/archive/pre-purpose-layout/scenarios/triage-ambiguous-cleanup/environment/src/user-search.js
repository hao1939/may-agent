/**
 * User Search Module
 * Search and filter users by various criteria.
 */

const { listUsers } = require('./user-store');

/**
 * Search users by username prefix.
 * @param {string} prefix 
 * @returns {Array<object>}
 */
function searchByUsername(prefix) {
  if (!prefix || typeof prefix !== 'string') return [];
  const lower = prefix.toLowerCase();
  return listUsers().filter(u => u.username.toLowerCase().startsWith(lower));
}

/**
 * Search users by email domain.
 * @param {string} domain 
 * @returns {Array<object>}
 */
function searchByDomain(domain) {
  if (!domain || typeof domain !== 'string') return [];
  const lower = domain.toLowerCase();
  return listUsers().filter(u => u.email.toLowerCase().endsWith(`@${lower}`));
}

/**
 * Find a user by exact email match.
 * @param {string} email 
 * @returns {object | null}
 */
function findByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const lower = email.toLowerCase();
  return listUsers().find(u => u.email.toLowerCase() === lower) || null;
}

module.exports = { searchByUsername, searchByDomain, findByEmail };
