// src/router.js - Request router
const { getUser, listUsers, createUser } = require('./handlers/users');
const { getProduct, listProducts, searchProducts } = require('./handlers/products');
const { healthCheck } = require('./handlers/health');
const { extractParams } = require('./utils/helpers');

const routes = {
  GET: [
    { pattern: '/health', handler: healthCheck },
    { pattern: '/api/users', handler: listUsers },
    { pattern: '/api/users/:id', handler: getUser },
    { pattern: '/api/products', handler: listProducts },
    { pattern: '/api/products/search', handler: searchProducts },
    { pattern: '/api/products/:id', handler: getProduct }
  ],
  POST: [
    { pattern: '/api/users', handler: createUser }
  ]
};

function router(req, res) {
  const methodRoutes = routes[req.method] || [];
  
  for (const route of methodRoutes) {
    const params = extractParams(route.pattern, req.path);
    if (params !== null) {
      req.params = params;
      route.handler(req, res);
      return;
    }
  }
  
  // No route matched
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

module.exports = { router };
