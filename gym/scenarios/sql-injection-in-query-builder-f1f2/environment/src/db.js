/**
 * Simple in-memory database simulation for products.
 * In production this would be backed by SQLite/Postgres.
 *
 * Supports parameterized queries: pass `?` placeholders in the SQL string
 * and supply values in a separate `params` array to prevent SQL injection.
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
 * Supports basic WHERE clauses: LIKE, category =, id =.
 * 
 * Parameters are bound safely via the `params` array — they are never
 * interpolated into the SQL string, preventing SQL injection.
 *
 * @param {string} sql - SQL query string with `?` placeholders
 * @param {Array} [params=[]] - Bound parameter values (replaces `?` placeholders)
 * @returns {Array|null} - matching rows, or null if no matches
 */
function executeQuery(sql, params = []) {
  let results = [...products];

  // Bind parameters: replace ? placeholders with safe values for matching
  let paramIndex = 0;

  // Handle WHERE id = ?
  const idMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
  if (idMatch) {
    const id = params[paramIndex++];
    results = results.filter(p => p.id === id);
  }

  // Handle WHERE id = N (backward compat for inline numeric IDs)
  if (!idMatch) {
    const idLiteralMatch = sql.match(/WHERE\s+id\s*=\s*(\d+)/i);
    if (idLiteralMatch) {
      const id = parseInt(idLiteralMatch[1], 10);
      results = results.filter(p => p.id === id);
    }
  }
  
  // Handle WHERE name LIKE ? (parameterized)
  const likeParamMatch = sql.match(/LIKE\s+\?/i);
  if (likeParamMatch) {
    const pattern = String(params[paramIndex++]).toLowerCase();
    // Strip leading/trailing % for LIKE pattern matching
    const stripped = pattern.replace(/^%|%$/g, '');
    results = results.filter(p => p.name.toLowerCase().includes(stripped));
  }

  // Handle WHERE name LIKE '%...%' (backward compat for inline patterns)
  if (!likeParamMatch) {
    const likeLiteralMatch = sql.match(/LIKE\s+'%(.+)%'/i);
    if (likeLiteralMatch) {
      const pattern = likeLiteralMatch[1].toLowerCase();
      results = results.filter(p => p.name.toLowerCase().includes(pattern));
    }
  }
  
  // Handle WHERE category = ? (parameterized)
  const catParamMatch = sql.match(/category\s*=\s*\?/i);
  if (catParamMatch) {
    const cat = String(params[paramIndex++]).toLowerCase();
    results = results.filter(p => p.category === cat);
  }

  // Handle WHERE category = '...' (backward compat for inline values)
  if (!catParamMatch) {
    const catLiteralMatch = sql.match(/category\s*=\s*'([^']+)'/i);
    if (catLiteralMatch) {
      const cat = catLiteralMatch[1].toLowerCase();
      results = results.filter(p => p.category === cat);
    }
  }
  
  // Return null when no results found (simulates DB driver behavior)
  if (results.length === 0) return null;
  
  return results;
}

module.exports = { executeQuery };
