// src/handlers/products.js - Product endpoint handlers
const { getDb } = require('../lib/database');

async function getProduct(req, res) {
  const { id } = req.params;
  const product = await getDb().findProduct(id);
  
  if (!product) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Product not found' }));
    return;
  }
  
  res.end(JSON.stringify(product));
}

async function listProducts(req, res) {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const products = await getDb().listProducts(limit, offset);
  res.end(JSON.stringify({ products, limit, offset }));
}

async function searchProducts(req, res) {
  const { q } = req.query;
  if (!q) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Query parameter q required' }));
    return;
  }
  
  const results = await getDb().searchProducts(q);
  res.end(JSON.stringify({ results, query: q }));
}

module.exports = { getProduct, listProducts, searchProducts };
