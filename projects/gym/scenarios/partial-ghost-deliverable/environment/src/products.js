/**
 * products.js — Product API endpoints
 */
const express = require('express');
const router = express.Router();

// GET /products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await db.products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_PRODUCT_NOT_FOUND", 
          message: "Product not found", 
          details: { productId: req.params.id } 
        } 
      });
    }
    res.json({ data: product });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_PRODUCT_FETCH", 
        message: "Failed to fetch product", 
        details: { productId: req.params.id, reason: err.message } 
      } 
    });
  }
});

// PUT /products/:id
router.put('/:id', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ 
        error: { 
          code: "ERR_PRODUCT_INVALID_INPUT", 
          message: "Product name is required", 
          details: { field: "name", received: req.body.name } 
        } 
      });
    }
    const product = await db.products.update(req.params.id, req.body);
    if (!product) {
      return res.status(404).json({ 
        error: { 
          code: "ERR_PRODUCT_NOT_FOUND", 
          message: "Product not found for update", 
          details: { productId: req.params.id } 
        } 
      });
    }
    res.json({ data: product });
  } catch (err) {
    res.status(500).json({ 
      error: { 
        code: "ERR_PRODUCT_UPDATE", 
        message: "Failed to update product", 
        details: { productId: req.params.id, reason: err.message } 
      } 
    });
  }
});

module.exports = router;
