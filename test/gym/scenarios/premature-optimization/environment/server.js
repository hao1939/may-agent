/**
 * Simple product API server (no external dependencies)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getCached, setCached } = require('./lib/cache');

const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');

function loadProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/products') {
    const cached = getCached('all-products');
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(cached);
      return;
    }
    
    const products = loadProducts();
    const json = JSON.stringify(products);
    setCached('all-products', json);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(json);
    return;
  }
  
  const match = url.pathname.match(/^\/products\/(\d+)$/);
  if (match) {
    const id = parseInt(match[1]);
    const cacheKey = `product-${id}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(cached);
      return;
    }
    
    const products = loadProducts();
    const product = products.find(p => p.id === id);
    if (product) {
      const json = JSON.stringify(product);
      setCached(cacheKey, json);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(json);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(handleRequest);

// Export for testing, or start if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = { server, handleRequest };
