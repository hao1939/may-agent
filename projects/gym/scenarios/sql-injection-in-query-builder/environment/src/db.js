/**
 * Simple in-memory database simulation for products.
 * In production this would be backed by SQLite/Postgres.
 */

const products = [
  { id: 1, name: 'Wireless Mouse', price: 29.99, category: 'electronics' },
  { id: 2, name: 'USB-C Cable', price: 12.50, category: 'electronics' },
  { id: 3, name: 'Desk Lamp', price: 45.00, category: 'office' },
  { id: 4, name: 'Notebook Pack', price: 8.99, category: 'office' },
  { id: 5, name: 'Wireless Keyboard', price: 59.99, category: 'electronics' },
  { id: 6, name: 'Monitor Stand', price: 34.99, category: 'office' },
  { id: 7, name: 'HDMI Cable', price: 15.00, category: 'electronics' },
  { id: 8, name: 'Ergonomic Chair', price: 299.00, category: 'furniture' },
];

/**
 * Find products whose name contains the given search term (case-insensitive).
 * @param {string} term - Search term
 * @returns {Array} matching products (empty array if none)
 */
function findProductsByName(term) {
  const pattern = String(term).toLowerCase();
  return products.filter(p => p.name.toLowerCase().includes(pattern));
}

/**
 * Find products by category (case-insensitive).
 * @param {string} category
 * @returns {Array} matching products (empty array if none)
 */
function findProductsByCategory(category) {
  const cat = String(category).toLowerCase();
  return products.filter(p => p.category === cat);
}

/**
 * Find a single product by numeric ID.
 * @param {number} id
 * @returns {object|null}
 */
function findProductById(id) {
  const numId = Number(id);
  return products.find(p => p.id === numId) || null;
}

module.exports = { findProductsByName, findProductsByCategory, findProductById };
