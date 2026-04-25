/**
 * PR #2: Fix pagination in search results
 * 
 * Bug: Search returns duplicate results on page boundaries
 * Fix: Corrected the slice boundaries for pagination
 * 
 */

/**
 * Paginate an array of search results.
 * @param {Array} results - Full result set
 * @param {number} page - 1-based page number
 * @param {number} pageSize - Items per page
 * @returns {{ items: Array, totalPages: number, currentPage: number }}
 */
function getPage(results, page, pageSize) {
  if (!Array.isArray(results) || results.length === 0) {
    return { items: [], totalPages: 0, currentPage: 0 };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.ceil(results.length / safeSize);

  if (safePage > totalPages) {
    return { items: [], totalPages, currentPage: safePage };
  }

  // BUG: off-by-one — start is correct but end overshoots by 1
  const start = (safePage - 1) * safeSize;
  const end = safePage * safeSize + 1; // <-- should be: safePage * safeSize

  return {
    items: results.slice(start, end),
    totalPages,
    currentPage: safePage,
  };
}

/**
 * Search items by query string and return paginated results.
 * @param {Array<{id: string, title: string}>} items
 * @param {string} query
 * @param {number} page
 * @param {number} pageSize
 */
function search(items, query, page = 1, pageSize = 10) {
  if (!query || typeof query !== 'string') {
    return getPage([], 1, pageSize);
  }

  const lowerQuery = query.toLowerCase();
  const matched = items.filter(item =>
    item.title.toLowerCase().includes(lowerQuery)
  );

  return getPage(matched, page, pageSize);
}

module.exports = { getPage, search };
