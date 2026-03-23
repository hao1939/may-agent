const express = require('express');
const db = require('./db');

const app = express();

// Helper: detect connection pool exhaustion errors
function isPoolExhaustedError(err) {
  return err.message && (
    err.message.includes('timeout') ||
    err.message.includes('pool') ||
    err.message.includes('connection') ||
    err.code === '53300' // too_many_connections
  );
}

// GET /api/orders - fetch all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json({ orders });
  } catch (err) {
    if (isPoolExhaustedError(err)) {
      return res.status(503).set('Retry-After', '5').json({
        error: 'Service temporarily unavailable — connection pool exhausted',
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/:id - fetch single order  
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ order: order.rows[0] });
  } catch (err) {
    if (isPoolExhaustedError(err)) {
      return res.status(503).set('Retry-After', '5').json({
        error: 'Service temporarily unavailable — connection pool exhausted',
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/orders - create new order
app.post('/api/orders', async (req, res) => {
  try {
    const { customer_id, items } = req.body;
    const order = await db.query(
      'INSERT INTO orders (customer_id, items) VALUES ($1, $2) RETURNING *',
      [customer_id, JSON.stringify(items)]
    );
    res.status(201).json({ order: order.rows[0] });
  } catch (err) {
    if (isPoolExhaustedError(err)) {
      return res.status(503).set('Retry-After', '5').json({
        error: 'Service temporarily unavailable — connection pool exhausted',
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
