const { createSession } = require('../middleware/auth');
const userDb = require('../data/users');

const authController = {
  login(req, res) {
    const { username, password } = req.body;
    const user = userDb.find(u => u.username === username && u.password === password);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = createSession(user.id);
    res.json({ success: true, token });
  }
};

module.exports = authController;
