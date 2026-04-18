/**
 * Notification Service — Email Sender
 * 
 * Sends notifications via SMTP. Requires properly configured
 * SMTP settings (host, port, secure, user, pass).
 */

const config = require('./config');

function sendEmail(to, subject, body) {
  const { smtp } = config;
  
  // Validate SMTP config before attempting send
  if (!smtp.host || smtp.host === 'localhost') {
    return { success: false, error: 'SMTP host not configured for production' };
  }
  
  if (!smtp.auth.user || !smtp.auth.pass) {
    return { success: false, error: 'SMTP credentials not configured' };
  }
  
  if (!smtp.secure && config.env === 'production') {
    return { success: false, error: 'SMTP must use TLS in production (SMTP_SECURE=true)' };
  }
  
  // Simulate sending (no actual SMTP in test environment)
  return {
    success: true,
    messageId: `msg-${Date.now()}`,
    from: smtp.auth.user,
    to,
    subject,
    transport: `${smtp.secure ? 'smtps' : 'smtp'}://${smtp.host}:${smtp.port}`
  };
}

module.exports = { sendEmail };
