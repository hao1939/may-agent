/**
 * Notification Service — dispatches alerts via email, SMS, and webhook.
 *
 * PROD-4421 fixes applied: error handling, rate limiting, retry queue integration.
 * Previous session added error handling and rate limiter integration.
 */

const config = require('./config');
const templateEngine = require('./template-engine');
const rateLimiter = require('./rate-limiter');
const retryQueue = require('./retry-queue');

async function sendNotification(userId, channel, eventType, data) {
  // Rate limit check (added in PROD-4421 fix)
  const limit = rateLimiter.checkLimit(userId, channel);
  if (!limit.allowed) {
    throw new Error(`Rate limit exceeded for ${userId}:${channel}. Reset in ${limit.resetIn}ms`);
  }

  const template = templateEngine.render(eventType, data);

  let result;
  switch (channel) {
    case 'email':
      result = await sendEmail(userId, template);
      break;
    case 'sms':
      result = await sendSms(userId, template);
      break;
    case 'webhook':
      result = await sendWebhook(userId, template);
      break;
    default:
      throw new Error(`Unknown notification channel: ${channel}`);
  }

  // Record successful send for rate limiting
  rateLimiter.recordSend(userId, channel);
  return result;
}

async function sendEmail(userId, content) {
  const endpoint = config.get('email.endpoint');
  const apiKey = config.get('email.apiKey');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subject: content.subject, body: content.body })
    });

    if (!response.ok) {
      throw new Error(`Email send failed: HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    retryQueue.enqueue({ userId, channel: 'email', content }, err);
    throw err;
  }
}

async function sendSms(userId, content) {
  const endpoint = config.get('sms.endpoint');
  const apiKey = config.get('sms.apiKey');
  const maxLen = config.get('sms.maxLength') || 160;

  const message = content.body.length > maxLen
    ? content.body.substring(0, maxLen - 3) + '...'
    : content.body;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ userId, message })
    });

    if (!response.ok) {
      throw new Error(`SMS send failed: HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    retryQueue.enqueue({ userId, channel: 'sms', content }, err);
    throw err;
  }
}

async function sendWebhook(userId, content) {
  const webhookUrl = config.get('webhook.url');

  // BUG REMAINING: no timeout on webhook fetch — was supposed to be added
  // but previous session only added error handling, not timeout
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, event: content.subject, payload: content })
    });

    if (!response.ok) {
      throw new Error(`Webhook send failed: HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    retryQueue.enqueue({ userId, channel: 'webhook', content }, err);
    throw err;
  }
}

async function broadcastNotification(userIds, channel, eventType, data) {
  const results = [];
  for (const userId of userIds) {
    try {
      const result = await sendNotification(userId, channel, eventType, data);
      results.push({ userId, result, status: 'sent' });
    } catch (err) {
      results.push({ userId, error: err.message, status: 'failed' });
    }
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
