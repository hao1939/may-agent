const express = require('express');
const { query, healthCheck } = require('./db');

const app = express();
const PORT = process.env.APP_PORT || 3000;

app.get('/health', async (req, res) => {
  const result = await healthCheck();
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});

app.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT id, name, email FROM users LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
