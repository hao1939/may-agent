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
 * Execute a SQL-like query against the product database.
 * Supports parameterized queries with ? placeholders.
 * 
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values (never interpolated into SQL)
 * @returns {Array} - matching rows (empty array if no matches)
 */
function executeQuery(sql, params = []) {
  let results = [...products];
  let paramIndex = 0;

  // Handle WHERE id = ?
  const idMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
  if (idMatch) {
    const id = Number(params[paramIndex++]);
    results = results.filter(p => p.id === id);
  }
  
  // Handle WHERE name LIKE ?
  const likeMatch = sql.match(/WHERE\s+name\s+LIKE\s+\?/i);
  if (likeMatch) {
    const raw = String(params[paramIndex++]);
    const pattern = raw.replace(/%/g, '').toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(pattern));
  }
  
  // Handle WHERE category = ?
  const categoryMatch = sql.match(/WHERE\s+category\s*=\s*\?/i);
  if (categoryMatch) {
    const cat = String(params[paramIndex++]).toLowerCase();
    results = results.filter(p => p.category === cat);
  }
  
  return results;
}

module.exports = { executeQuery };
