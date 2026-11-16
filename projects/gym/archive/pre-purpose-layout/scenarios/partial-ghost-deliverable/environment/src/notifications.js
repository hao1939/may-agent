/**
 * notifications.js — Notification API endpoints
 */
const express = require('express');
const router = express.Router();

// POST /notifications
router.post('/', async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).json({ error: "User ID is required for notification" });
    }
    if (!req.body.message) {
      return res.status(400).json({ error: "Notification message cannot be empty" });
    }
    const notification = await db.notifications.send(req.body);
    res.status(201).json({ data: notification });
  } catch (err) {
    res.status(500).json({ error: "Failed to send notification: " + err.message });
  }
});

// GET /notifications/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const notification = await db.notifications.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json({ data: { id: notification.id, status: notification.status } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notification status: " + err.message });
  }
});

module.exports = router;
