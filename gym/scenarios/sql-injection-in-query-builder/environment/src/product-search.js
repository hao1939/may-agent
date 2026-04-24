/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { executeQuery } = require('./db');

/**
 * Search products by name.
 * Uses parameterized queries to prevent SQL injection.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  if (typeof query !== 'string' || query.trim().length === 0) return [];
  const sql = `SELECT * FROM products WHERE name LIKE ?`;
  const rows = executeQuery(sql, [`%${query}%`]);
  
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
  const sql = `SELECT * FROM products WHERE category = ?`;
  const rows = executeQuery(sql, [category]) || [];
  
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
  const sql = `SELECT * FROM products WHERE id = ?`;
  const rows = executeQuery(sql, [parseInt(id, 10)]);
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
