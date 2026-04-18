/**
 * Template Engine — renders notification templates for different event types.
 *
 * Each event type has a subject and body template with {{variable}} placeholders.
 */

const TEMPLATES = {
  'order.confirmed': {
    subject: 'Order #{{orderId}} Confirmed',
    body: 'Hi {{userName}}, your order #{{orderId}} for {{itemCount}} items totaling ${{total}} has been confirmed. Expected delivery: {{deliveryDate}}.'
  },
  'order.shipped': {
    subject: 'Order #{{orderId}} Shipped',
    body: 'Hi {{userName}}, your order #{{orderId}} has shipped via {{carrier}}. Tracking: {{trackingNumber}}.'
  },
  'payment.failed': {
    subject: 'Payment Failed for Order #{{orderId}}',
    body: 'Hi {{userName}}, we could not process payment for order #{{orderId}}. Reason: {{failureReason}}. Please update your payment method.'
  },
  'account.locked': {
    subject: 'Account Security Alert',
    body: 'Hi {{userName}}, your account has been temporarily locked due to {{lockReason}}. Please contact support or wait {{lockDuration}} minutes.'
  },
  'password.reset': {
    subject: 'Password Reset Request',
    body: 'Hi {{userName}}, click here to reset your password: {{resetLink}}. This link expires in {{expiryMinutes}} minutes.'
  }
};

function render(eventType, data) {
  const template = TEMPLATES[eventType];
  if (!template) {
    // BUG: returns { subject: undefined, body: undefined } instead of throwing
    return { subject: undefined, body: undefined };
  }

  const subject = interpolate(template.subject, data);
  const body = interpolate(template.body, data);

  return { subject, body };
}

function interpolate(str, data) {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

function listEventTypes() {
  return Object.keys(TEMPLATES);
}

module.exports = { render, interpolate, listEventTypes };
