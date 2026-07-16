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
 * Supports basic WHERE clauses with parameterized queries: LIKE ?, category = ?, id = ?.
 *
 * Parameters are used directly in filter logic — never interpolated into the SQL
 * string — to prevent SQL injection.
 * 
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} [params=[]] - Parameter values to bind to ? placeholders
 * @returns {Array} - matching rows (empty array if no matches)
 */
function executeQuery(sql, params = []) {
  let results = [...products];
  let paramIndex = 0;
  const nextParam = () => params[paramIndex++];

  // Handle WHERE id = ?
  if (/WHERE\s+id\s*=\s*\?/i.test(sql)) {
    const id = Number(nextParam());
    results = results.filter(p => p.id === id);
  }

  // Handle WHERE name LIKE ?
  if (/WHERE\s+name\s+LIKE\s+\?/i.test(sql)) {
    const pattern = String(nextParam()).replace(/^%|%$/g, '').toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(pattern));
  }

  // Handle WHERE category = ?
  if (/WHERE\s+category\s*=\s*\?/i.test(sql)) {
    const cat = String(nextParam()).toLowerCase();
    results = results.filter(p => p.category === cat);
  }

  // Return empty array when no results found (consistent array return type)
  return results;
}

module.exports = { executeQuery };
