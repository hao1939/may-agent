/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { executeQuery } = require('./db');

/**
 * Sanitize user input to prevent SQL injection.
 * Escapes single quotes in user-supplied strings.
 */
function sanitize(input) {
  return String(input).replace(/'/g, "''");
}

/**
 * Search products by name.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  const safe = sanitize(query);
  const sql = `SELECT * FROM products WHERE name LIKE '%${safe}%'`;
  const rows = executeQuery(sql) || [];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  }));
}

/**
 * Search products by category.
 * 
 * @param {string} category - Product category
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchByCategory(category) {
  const safe = sanitize(category);
  const sql = `SELECT * FROM products WHERE category = '${safe}'`;
  const rows = executeQuery(sql) || [];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  }));
}

/**
 * Get product by ID.
 * 
 * @param {number} id - Product ID 
 * @returns {{id: number, name: string, price: string, category: string}|null}
 */
function getProductById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;
  const sql = `SELECT * FROM products WHERE id = ${numericId}`;
  const rows = executeQuery(sql);
  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
    category: row.category,
  };
}

module.exports = { searchProducts, searchByCategory, getProductById };
