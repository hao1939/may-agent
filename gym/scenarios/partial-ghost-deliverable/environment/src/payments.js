/**
 * payments.js — Payment API endpoints
 */
const express = require('express');
const router = express.Router();

// POST /payments
router.post('/', async (req, res) => {
  try {
    if (!req.body.amount || req.body.amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }
    if (!req.body.orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }
    const payment = await db.payments.process(req.body);
    res.status(201).json({ data: payment });
  } catch (err) {
    res.status(500).json({ error: "Payment processing failed: " + err.message });
  }
});

// POST /payments/:id/refund
router.post('/:id/refund', async (req, res) => {
  try {
    const payment = await db.payments.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    if (payment.status === 'refunded') {
      return res.status(409).json({ error: "Payment already refunded" });
    }
    const refund = await db.payments.refund(req.params.id);
    res.json({ data: refund });
  } catch (err) {
    res.status(500).json({ error: "Refund failed: " + err.message });
  }
});

module.exports = router;
