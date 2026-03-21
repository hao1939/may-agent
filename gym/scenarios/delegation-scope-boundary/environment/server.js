const express = require('express');
const db = require('./db');

const app = express();

// GET /api/orders - fetch all orders
app.get('/api/orders', async (req, res) => {
  const orders = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json({ orders });
});

// GET /api/orders/:id - fetch single order  
app.get('/api/orders/:id', async (req, res) => {
  const order = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order.rows.length) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ order: order.rows[0] });
});

// POST /api/orders - create new order
app.post('/api/orders', async (req, res) => {
  const { customer_id, items } = req.body;
  const order = await db.query(
    'INSERT INTO orders (customer_id, items) VALUES ($1, $2) RETURNING *',
    [customer_id, JSON.stringify(items)]
  );
  res.status(201).json({ order: order.rows[0] });
});

module.exports = app;
