/**
 * Paginate an array of items.
 * @param {Array} items - The items to paginate
 * @param {number} page - 1-based page number
 * @param {number} pageSize - Items per page
 * @returns {{ items: Array, page: number, totalPages: number, totalItems: number }}
 */
function paginate(items, page, pageSize) {
  if (!Array.isArray(items)) throw new Error("items must be an array");
  if (pageSize < 1) throw new Error("pageSize must be >= 1");

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Clamp page to valid range
  const safePage = Math.max(1, Math.min(page, totalPages));

  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page: safePage,
    totalPages,
    totalItems,
  };
}

module.exports = { paginate };
