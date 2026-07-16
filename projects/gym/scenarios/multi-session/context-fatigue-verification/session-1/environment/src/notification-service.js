/**
 * Notification Service — dispatches alerts via email, SMS, and webhook.
 *
 * Known issue: error handling is incomplete and some channels
 * silently swallow failures. Needs hardening for production.
 */

const config = require('./config');
const templateEngine = require('./template-engine');

async function sendNotification(userId, channel, eventType, data) {
  const template = templateEngine.render(eventType, data);

  switch (channel) {
    case 'email':
      return sendEmail(userId, template);
    case 'sms':
      return sendSms(userId, template);
    case 'webhook':
      return sendWebhook(userId, template);
    default:
      // BUG: silently returns undefined for unknown channels
      return;
  }
}

async function sendEmail(userId, content) {
  const endpoint = config.get('email.endpoint');
  const apiKey = config.get('email.apiKey');
  // BUG: no error handling — if endpoint is null, this crashes silently
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subject: content.subject, body: content.body })
  });
  return response.json();
}

async function sendSms(userId, content) {
  const endpoint = config.get('sms.endpoint');
  const apiKey = config.get('sms.apiKey');
  const maxLen = config.get('sms.maxLength') || 160;

  // Truncate message for SMS
  const message = content.body.length > maxLen
    ? content.body.substring(0, maxLen - 3) + '...'
    : content.body;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ userId, message })
  });
  return response.json();
}

async function sendWebhook(userId, content) {
  const webhookUrl = config.get('webhook.url');
  // BUG: no timeout, no retry, no error handling
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, event: content.subject, payload: content })
  });
  return response.json();
}

async function broadcastNotification(userIds, channel, eventType, data) {
  const results = [];
  for (const userId of userIds) {
    const result = await sendNotification(userId, channel, eventType, data);
    results.push({ userId, result });
  }
  return results;
}

module.exports = {
  sendNotification,
  sendEmail,
  sendSms,
  sendWebhook,
  broadcastNotification
};
