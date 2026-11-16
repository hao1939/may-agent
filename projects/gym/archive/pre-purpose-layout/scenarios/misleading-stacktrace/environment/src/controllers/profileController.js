const UserService = require('../services/userService');

const profileController = {
  async show(req, res) {
    try {
      // req.user is set by auth middleware
      const profile = await UserService.getProfile(req.user);
      res.json({ success: true, data: profile });
    } catch (err) {
      console.error('Profile error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

module.exports = profileController;
