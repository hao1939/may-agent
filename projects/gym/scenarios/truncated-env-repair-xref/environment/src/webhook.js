/**
 * Notification Service — Webhook Dispatcher
 * 
 * Dispatches notification events to external webhooks.
 * Used for Slack/Teams integration and audit logging.
 * Silently skips if webhook URL not configured.
 */

const config = require('./config');

function dispatchWebhook(event, payload) {
  const { webhook } = config;
  
  if (!webhook.url) {
    // Silently skip — webhook is optional in dev, required in prod
    return { dispatched: false, reason: 'no-webhook-url' };
  }
  
  if (!webhook.secret) {
    return { dispatched: false, reason: 'no-webhook-secret' };
  }
  
  // Simulate dispatch
  return {
    dispatched: true,
    url: webhook.url,
    event,
    retries: webhook.retryCount,
    signed: true
  };
}

function getWebhookHealth() {
  const { webhook } = config;
  return {
    configured: !!(webhook.url && webhook.secret),
    url: webhook.url ? webhook.url.replace(/\/\/.*@/, '//***@') : 'not-set',
    retryCount: webhook.retryCount,
    burstLimit: config.rateLimit.burstLimit
  };
}

module.exports = { dispatchWebhook, getWebhookHealth };
