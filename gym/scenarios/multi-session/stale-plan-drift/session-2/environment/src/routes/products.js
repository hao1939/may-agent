/**
 * products.js — Product Routes
 * 
 * All routes require authentication (applied at app.js level).
 * Updated by @devon on 2026-04-08 — imports from split middleware modules.
 */
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');

// In-memory product store
const products = [
  { id: 1, name: 'Widget A', price: 29.99, stock: 150 },
  { id: 2, name: 'Widget B', price: 49.99, stock: 75 },
  { id: 3, name: 'Gadget X', price: 199.99, stock: 20 }
];

// GET /api/products
router.get('/', (req, res) => {
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  const { name, price, stock } = req.body;
  const newProduct = { id: products.length + 1, name, price, stock: stock || 0 };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

module.exports = router;
