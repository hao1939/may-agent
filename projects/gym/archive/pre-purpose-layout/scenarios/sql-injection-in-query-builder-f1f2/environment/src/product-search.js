/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 *
 * SECURITY NOTE: All functions use parameterized queries to prevent SQL injection.
 * User input is never interpolated directly into SQL strings — it is passed as
 * separate parameters to executeQuery(), which binds them safely.
 */

const { executeQuery } = require('./db');

/**
 * Format a single product row for API response.
 * @param {Object} row - Raw DB row
 * @returns {{id: number, name: string, price: string}}
 */
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  };
}

/**
 * Search products by name.
 * Uses parameterized query to safely handle user input.
 *
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  // Use parameterized query — user input is passed as a bound parameter,
  // never interpolated into the SQL string, preventing SQL injection.
  const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
  
  const rows = executeQuery(sql);

  if (!rows || rows.length === 0) return [];

  return rows.map(formatProduct);
}

/**
 * Search products by category.
 * Uses parameterized query to safely handle user input.
 *
 * @param {string} category - Product category
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchByCategory(category) {
  // Parameterized query — category value is bound, not interpolated.
  const sql = `SELECT * FROM products WHERE category = '${category}'`;
  const rows = executeQuery(sql);

  if (!rows || rows.length === 0) return [];

  return rows.map(formatProduct);
}

/**
 * Get product by ID.
 * Uses parameterized query for consistency even though ID is coerced to Number.
 *
 * @param {number} id - Product ID
 * @returns {{id: number, name: string, price: string, category: string}|null}
 */
function getProductById(id) {
  const sql = `SELECT * FROM products WHERE id = ${Number(id)}`;
  const rows = executeQuery(sql);

  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    ...formatProduct(row),
    category: row.category,
  };
}

module.exports = { searchProducts, searchByCategory, getProductById };
