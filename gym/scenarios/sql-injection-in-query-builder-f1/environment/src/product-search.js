/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { executeQuery } = require('./db');

/**
 * Search products by name.
 * Builds a SQL query and returns formatted results.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  // Build the SQL query with the user's search term
  const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
  
  const rows = executeQuery(sql);
  
  // Format results for the API response
  const formatted = rows.map(row => ({
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  }));
  
  return formatted;
}

/**
 * Search products by category.
 * 
 * @param {string} category - Product category
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchByCategory(category) {
  const sql = `SELECT * FROM products WHERE category = '${category}'`;
  
  const rows = executeQuery(sql);
  
  const formatted = rows.map(row => ({
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
  }));
  
  return formatted;
}

/**
 * Get product by ID.
 * 
 * @param {number} id - Product ID 
 * @returns {{id: number, name: string, price: string, category: string}|null}
 */
function getProductById(id) {
  const sql = `SELECT * FROM products WHERE id = ${id}`;
  
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
