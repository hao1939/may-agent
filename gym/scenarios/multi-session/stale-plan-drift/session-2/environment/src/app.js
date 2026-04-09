/**
 * app.js — Express Application Setup
 * 
 * Configures middleware and routes for the API server.
 * Updated by @devon on 2026-04-08 — middleware imports now use the split directory.
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const {
  authMiddleware,
  sessionMiddleware,
  requestLogger,
  rateLimiter
} = require('./middleware');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');

const app = express();

// Global middleware
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use(rateLimiter);
app.use(sessionMiddleware);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', authMiddleware, productRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
