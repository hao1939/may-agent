/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { executeQuery } = require('./db');

/**
 * Format a product row for the API response.
 * @param {Object} row - Raw product row from the database
 * @param {boolean} includeCategory - Whether to include category field
 * @returns {Object}
 */
function formatProduct(row, includeCategory = false) {
  const result = {
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  };
  if (includeCategory) {
    result.category = row.category;
  }
  return result;
}

/**
 * Search products by name.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  if (typeof query !== 'string' || query.trim().length === 0) return [];

  const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
  const rows = executeQuery(sql);

  return rows.map(row => formatProduct(row));
}

/**
 * Search products by category.
 * 
 * @param {string} category - Product category
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchByCategory(category) {
  if (typeof category !== 'string' || category.trim().length === 0) return [];

  const sql = `SELECT * FROM products WHERE category = '${category}'`;
  const rows = executeQuery(sql);

  return rows.map(row => formatProduct(row));
}

/**
 * Get product by ID.
 * 
 * @param {number} id - Product ID 
 * @returns {{id: number, name: string, price: string, category: string}|null}
 */
function getProductById(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;

  const sql = `SELECT * FROM products WHERE id = ${numId}`;
  const rows = executeQuery(sql);
  if (rows.length === 0) return null;

  return formatProduct(rows[0], true);
}

module.exports = { searchProducts, searchByCategory, getProductById };
