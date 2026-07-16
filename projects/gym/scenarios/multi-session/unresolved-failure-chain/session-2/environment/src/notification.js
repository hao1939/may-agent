/**
 * notification.js — Notification Service
 * 
 * Sends notifications with formatted timestamps.
 */

const { formatTimestamp } = require('./utils');

const notifications = [];

function createNotification(type, recipient, message) {
  const notification = {
    id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    recipient,
    message,
    createdAt: new Date(),
    displayTime: formatTimestamp(new Date(), 'full'),
    read: false
  };
  notifications.push(notification);
  return notification;
}

function getUnread(recipient) {
  return notifications
    .filter(n => n.recipient === recipient && !n.read)
    .map(n => ({
      ...n,
      relativeTime: formatTimestamp(n.createdAt, 'relative'),
      shortTime: formatTimestamp(n.createdAt, 'short')
    }));
}

function markRead(notificationId) {
  const notif = notifications.find(n => n.id === notificationId);
  if (notif) {
    notif.read = true;
    notif.readAt = formatTimestamp(new Date(), 'iso');
  }
  return notif;
}

function formatNotificationDigest(recipient) {
  const unread = getUnread(recipient);
  if (unread.length === 0) return 'No unread notifications.';

  const header = `Notification Digest — ${formatTimestamp(new Date(), 'full')}`;
  const lines = unread.map(n => 
    `  [${n.type}] ${n.relativeTime} — ${n.message}`
  );
  return [header, '-'.repeat(50), ...lines].join('\n');
}

module.exports = {
  createNotification,
  getUnread,
  markRead,
  formatNotificationDigest
};
