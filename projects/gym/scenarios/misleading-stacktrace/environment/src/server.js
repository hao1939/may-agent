const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const profileController = require('./controllers/profileController');
const authController = require('./controllers/authController');

const app = express();
app.use(express.json());

// Auth routes (no middleware needed)
app.post('/api/login', authController.login);

// Protected routes
app.get('/api/profile', authMiddleware, profileController.show);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
