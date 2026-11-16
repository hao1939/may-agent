// dashboard.js — Dashboard rendering
const { getUserData } = require('./userService');

function renderDashboard(userId) {
  const user = getUserData(userId);
  return {
    title: `Dashboard — ${user.name}`,
    role: user.role,
    email: user.email,
    lastFetch: user.fetchedAt,
  };
}

function renderAdminPanel(adminId) {
  const admin = getUserData(adminId);
  if (admin.role !== 'admin') throw new Error('Not an admin');
  return { panel: 'admin', user: admin.name };
}

module.exports = { renderDashboard, renderAdminPanel };
