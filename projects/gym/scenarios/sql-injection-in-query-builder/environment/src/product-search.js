/**
 * Product search service.
 * Handles user search queries and returns formatted results.
 */

const { findProductsByName, findProductsByCategory, findProductById } = require('./db');

/**
 * Search products by name.
 * 
 * @param {string} query - User's search term
 * @returns {Array<{id: number, name: string, price: string}>}
 */
function searchProducts(query) {
  if (typeof query !== 'string' || query.trim().length === 0) return [];
  const rows = findProductsByName(query) || [];

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
  if (typeof category !== 'string' || category.trim().length === 0) return [];
  const rows = findProductsByCategory(category) || [];

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
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;
  const row = findProductById(numId);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    price: `$${row.price.toFixed(2)}`,
    category: row.category,
  };
}

module.exports = { searchProducts, searchByCategory, getProductById };
