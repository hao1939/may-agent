// Notification service - sends alerts based on user permissions
// ALSO uses token-parser but NOT mentioned in task
const { parseToken, hasPermission } = require('./token-parser');

function canReceiveAlerts(tokenString) {
  const token = parseToken(tokenString);
  // BUG: Still using v1 field names
  return {
    userId: token.subject_id,              // Should be token.subject_idject_id
    canReceive: hasPermission(token, "alerts")  // Should be hasPermission(token, 'alerts')
  };
}

function sendNotification(tokenString, message) {
  const access = canReceiveAlerts(tokenString);
  if (!access.canReceive) {
    return { sent: false, reason: 'No alert permission' };
  }
  return { sent: true, to: access.userId, message };
}

module.exports = { canReceiveAlerts, sendNotification };
