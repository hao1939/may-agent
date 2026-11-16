/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { executeQuery } = require('./db');

/**
 * Format a product row for the API response.
 * @param {Object} row - Raw product row from the database
 * @returns {{id: number, name: string, price: string}}
 */
function formatProduct(row) {
  const price = typeof row.price === 'number' ? row.price : 0;
  return {
    id: row.id,
    name: row.name,
    price: `$${price.toFixed(2)}`,
  };
}

/**
 * Search products by name.
 * Uses parameterized queries to prevent SQL injection.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  if (typeof query !== 'string') return [];

  const sql = `SELECT * FROM products WHERE name LIKE ?`;
  const rows = executeQuery(sql, [`%${query}%`]);
  if (!rows || rows.length === 0) return [];

  return rows.map(formatProduct);
}

/**
 * Search products by category.
 * Uses parameterized queries to prevent SQL injection.
 * 
 * @param {string} category - Product category
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchByCategory(category) {
  if (typeof category !== 'string') return [];

  const sql = `SELECT * FROM products WHERE category = ?`;
  const rows = executeQuery(sql);
  if (!rows || rows.length === 0) return [];

  return rows.map(formatProduct);
}

/**
 * Get product by ID.
 * Uses parameterized queries to prevent SQL injection.
 * 
 * @param {number} id - Product ID 
 * @returns {{id: number, name: string, price: string, category: string}|null}
 */
function getProductById(id) {
  const sql = `SELECT * FROM products WHERE id = ?`;
  const rows = executeQuery(sql);
  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    ...formatProduct(row),
    category: row.category,
  };
}

module.exports = { searchProducts, searchByCategory, getProductById };
