/**
 * orders.js — Order API endpoints
 */
const express = require('express');
const router = express.Router();

// POST /orders
router.post('/', async (req, res) => {
  try {
    if (!req.body.items || req.body.items.length === 0) {
      return res.status(400).json({ 
        error: { 
          code: "ERR_ORDER_EMPTY", 
          message: "Order must contain at least one item", 
          details: { itemCount: req.body.items ? req.body.items.length : 0 } 
        } 
      });
    }
    const order = await db.orders.create(req.body);
    res.status(201).json({ data: order });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_ORDER_CREATE", 
        message: "Failed to create order", 
        details: { reason: err.message } 
      } 
    });
  }
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await db.orders.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_ORDER_NOT_FOUND", 
          message: "Order not found", 
          details: { orderId: req.params.id } 
        } 
      });
    }
    res.json({ data: order });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_ORDER_FETCH", 
        message: "Failed to fetch order", 
        details: { orderId: req.params.id, reason: err.message } 
      } 
    });
  }
});

// POST /orders/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const order = await db.orders.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_ORDER_NOT_FOUND", 
          message: "Order not found for cancellation", 
          details: { orderId: req.params.id } 
        } 
      });
    }
    if (order.status === 'shipped') {
      return res.status(409).json({ 
        error: { 
          code: "ERR_ORDER_ALREADY_SHIPPED", 
          message: "Cannot cancel a shipped order", 
          details: { orderId: req.params.id, status: order.status } 
        } 
      });
    }
    const cancelled = await db.orders.cancel(req.params.id);
    res.json({ data: cancelled });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_ORDER_CANCEL", 
        message: "Failed to cancel order", 
        details: { orderId: req.params.id, reason: err.message } 
      } 
    });
  }
});

// PUT /orders/:id
router.put('/:id', async (req, res) => {
  try {
    const order = await db.orders.update(req.params.id, req.body);
    if (!order) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_ORDER_NOT_FOUND", 
          message: "Order not found for update", 
          details: { orderId: req.params.id } 
        } 
      });
    }
    res.json({ data: order });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_ORDER_UPDATE", 
        message: "Failed to update order", 
        details: { orderId: req.params.id, reason: err.message } 
      } 
    });
  }
});

module.exports = router;
