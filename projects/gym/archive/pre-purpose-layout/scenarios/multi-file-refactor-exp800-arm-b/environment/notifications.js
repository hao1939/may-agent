// notifications.js — Notification service
const { getUserData } = require('./userService');

function sendWelcomeEmail(userId) {
  const user = getUserData(userId);
  return {
    to: user.email,
    subject: `Welcome, ${user.name}!`,
    sent: true,
  };
}

function notifyRoleChange(userId, newRole) {
  const user = getUserData(userId);
  return {
    to: user.email,
    subject: `Role changed to ${newRole}`,
    previousRole: user.role,
    sent: true,
  };
}

module.exports = { sendWelcomeEmail, notifyRoleChange };
