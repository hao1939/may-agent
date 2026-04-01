const express = require('express');
const { requestLogger, errorLogger, authMiddleware } = require('./middleware');
const profileRoutes = require('./routes/profile');

const app = express();

app.use(express.json());
app.use(requestLogger);
app.use(authMiddleware);

// Routes
app.use('/api/users', profileRoutes);

// Error handling
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
