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
 * Supports basic WHERE clauses: LIKE, category =, id =.
 * 
 * @param {string} sql - SQL query string
 * @returns {Array|null} - matching rows, or null if no matches
 */
function executeQuery(sql) {
  let results = [...products];

  // Handle WHERE id = N
  const idMatch = sql.match(/WHERE\s+id\s*=\s*(\d+)/i);
  if (idMatch) {
    const id = parseInt(idMatch[1], 10);
    results = results.filter(p => p.id === id);
  }
  
  // Handle WHERE name LIKE '%...%'
  const likeMatch = sql.match(/LIKE\s+'%(.+)%'/i);
  if (likeMatch) {
    const pattern = likeMatch[1].toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(pattern));
  }
  
  // Handle WHERE category = '...'
  const categoryMatch = sql.match(/category\s*=\s*'([^']+)'/i);
  if (categoryMatch) {
    const cat = categoryMatch[1].toLowerCase();
    results = results.filter(p => p.category === cat);
  }
  
  // Return null when no results found (simulates DB driver behavior)
  if (results.length === 0) return null;
  
  return results;
}

module.exports = { executeQuery };
