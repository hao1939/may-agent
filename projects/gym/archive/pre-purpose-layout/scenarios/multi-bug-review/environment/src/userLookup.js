/**
 * PR #1: Fix null pointer in user lookup
 * 
 * Bug: getUserById crashes when user cache is empty (cache = null)
 * Fix: Added null/undefined check before accessing cache entries
 * 
 */

const userCache = new Map();

/**
 * Initialize the cache from a database result set.
 * @param {Array<{id: string, name: string, email: string}>} users
 */
function initCache(users) {
  userCache.clear();
  if (!users || !Array.isArray(users)) {
    return;
  }
  for (const user of users) {
    userCache.set(user.id, { ...user, cachedAt: Date.now() });
  }
}

/**
 * Look up a user by ID. Returns null if not found or cache is empty.
 * @param {string} id
 * @returns {object|null}
 */
function getUserById(id) {
  if (!id || typeof id !== 'string') {
    return null;
  }
  if (!userCache || userCache.size === 0) {
    return null;
  }
  const entry = userCache.get(id);
  if (!entry) {
    return null;
  }
  return { id: entry.id, name: entry.name, email: entry.email };
}

/**
 * Bulk lookup - returns found users, skips missing ones.
 * @param {string[]} ids
 * @returns {object[]}
 */
function getUsersByIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids
    .map(id => getUserById(id))
    .filter(user => user !== null);
}

module.exports = { initCache, getUserById, getUsersByIds };
