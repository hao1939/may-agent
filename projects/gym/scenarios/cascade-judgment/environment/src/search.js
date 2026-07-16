/**
 * Search module — uses the cache for search results
 */

const { globalCache } = require('./cache');

// Simulated search index
const productIndex = [
  { id: 1, name: 'Widget Pro', category: 'electronics', price: 29.99 },
  { id: 2, name: 'Widget Basic', category: 'electronics', price: 9.99 },
  { id: 3, name: 'Gadget X', category: 'accessories', price: 49.99 },
  { id: 4, name: 'Super Tool', category: 'tools', price: 19.99 },
];

function search(query) {
  // Check cache first
  const cached = globalCache.getSearchResults(query);
  if (cached) {
    return { results: cached, source: 'cache' };
  }
  
  // Search the index
  const results = productIndex.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );
  
  // Cache the results (TTL = 24 hours, but index rebuilds hourly)
  // This means cached results can be up to 24 hours stale
  globalCache.setSearchResults(query, results);
  
  return { results, source: 'index' };
}

function rebuildIndex() {
  // In production, this queries the database and rebuilds the search index
  // It runs every hour via cron
  // Note: it does NOT invalidate the cache — old search results persist
  console.log('[search] Index rebuilt, but cache not invalidated');
}

module.exports = { search, rebuildIndex, productIndex };
