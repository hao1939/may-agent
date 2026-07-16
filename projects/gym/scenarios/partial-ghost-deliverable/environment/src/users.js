/**
 * users.js — User API endpoints
 */
const express = require('express');
const router = express.Router();

// GET /users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await db.users.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_USER_NOT_FOUND", 
          message: "User not found", 
          details: { userId: req.params.id } 
        } 
      });
    }
    res.json({ data: user });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_USER_FETCH", 
        message: "Failed to fetch user", 
        details: { userId: req.params.id, reason: err.message } 
      } 
    });
  }
});

// POST /users
router.post('/', async (req, res) => {
  try {
    if (!req.body.email) {
      return res.status(400).json({ 
        error: { 
          code: "ERR_USER_INVALID_INPUT", 
          message: "Email is required", 
          details: { field: "email", received: req.body.email } 
        } 
      });
    }
    const user = await db.users.create(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_USER_CREATE", 
        message: "Failed to create user", 
        details: { reason: err.message } 
      } 
    });
  }
});

// DELETE /users/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db.users.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_USER_NOT_FOUND", 
          message: "User not found for deletion", 
          details: { userId: req.params.id } 
        } 
      });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_USER_DELETE", 
        message: "Failed to delete user", 
        details: { userId: req.params.id, reason: err.message } 
      } 
    });
  }
});

module.exports = router;
