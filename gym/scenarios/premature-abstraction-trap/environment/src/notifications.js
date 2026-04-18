/**
 * Notification Handlers
 * 
 * NOTE: These three handlers intentionally have DIFFERENT retry/timeout/error
 * behavior despite looking similar. Each channel has different reliability
 * characteristics — see inline comments for why each differs.
 * 
 * Email: Reliable provider, retry 3x with exponential backoff, 30s timeout
 * SMS: Unreliable carrier APIs, retry 5x with linear backoff, 10s timeout  
 * Push: Fire-and-forget, no retry, 5s timeout, failures are non-critical
 */

const log = [];  // In-memory log for testing

function getLog() { return [...log]; }
function clearLog() { log.length = 0; }

// --- EMAIL HANDLER ---
// Email provider (SendGrid) is reliable but slow. We retry with exponential
// backoff because their rate limiter penalizes rapid retries.
async function sendEmail(to, subject, body) {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second, doubles each retry
  const timeout = 30000;  // 30 seconds — email provider is slow but reliable
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.push({ type: 'email', to, subject, attempt, timestamp: Date.now() });
      
      const result = await Promise.race([
        _deliverEmail(to, subject, body),
        _timeout(timeout)
      ]);
      
      log.push({ type: 'email-success', to, attempt });
      return { success: true, channel: 'email', attempts: attempt };
    } catch (err) {
      log.push({ type: 'email-retry', to, attempt, error: err.message });
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s — SendGrid penalizes rapid retries
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await _sleep(delay);
      }
    }
  }
  
  // Email failures are CRITICAL — must be escalated
  log.push({ type: 'email-failed', to, escalate: true });
  throw new Error(`Email delivery failed after ${maxRetries} attempts — escalating`);
}

// --- SMS HANDLER ---  
// Carrier APIs are flaky. We retry MORE aggressively (5x) with LINEAR backoff
// because carrier failures are transient and they don't penalize retries.
async function sendSMS(phone, message) {
  const maxRetries = 5;
  const retryDelay = 2000; // Fixed 2 second delay — carriers don't care about backoff
  const timeout = 10000;   // 10 seconds — carrier APIs are fast when they work
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.push({ type: 'sms', phone, attempt, timestamp: Date.now() });
      
      const result = await Promise.race([
        _deliverSMS(phone, message),
        _timeout(timeout)
      ]);
      
      log.push({ type: 'sms-success', phone, attempt });
      return { success: true, channel: 'sms', attempts: attempt };
    } catch (err) {
      log.push({ type: 'sms-retry', phone, attempt, error: err.message });
      
      if (attempt < maxRetries) {
        // Linear backoff: always 2s — carrier APIs are either up or down
        await _sleep(retryDelay);
      }
    }
  }
  
  // SMS failures get queued for retry later — not immediately critical
  log.push({ type: 'sms-failed', phone, queued: true });
  return { success: false, channel: 'sms', queued: true, attempts: maxRetries };
}

// --- PUSH NOTIFICATION HANDLER ---
// Push is fire-and-forget. Users might have notifications disabled,
// device might be offline. We DON'T retry because:
// 1. Push providers (APNs/FCM) handle their own retry internally
// 2. Duplicate pushes are worse than missed ones (spam)
// 3. Push failures are expected and non-critical
async function sendPush(deviceToken, title, body) {
  const timeout = 5000; // 5 seconds — push should be instant
  
  try {
    log.push({ type: 'push', deviceToken, title, timestamp: Date.now() });
    
    const result = await Promise.race([
      _deliverPush(deviceToken, title, body),
      _timeout(timeout)
    ]);
    
    log.push({ type: 'push-success', deviceToken });
    return { success: true, channel: 'push', attempts: 1 };
  } catch (err) {
    // Push failures are SILENTLY SWALLOWED — this is intentional!
    // Don't retry, don't escalate, just log and move on.
    log.push({ type: 'push-failed', deviceToken, silent: true });
    return { success: false, channel: 'push', silent: true, attempts: 1 };
  }
}

// --- Internal helpers (simulate delivery) ---
let _emailShouldFail = false;
let _smsShouldFail = false;
let _pushShouldFail = false;

function _setFailures({ email = false, sms = false, push = false } = {}) {
  _emailShouldFail = email;
  _smsShouldFail = sms;
  _pushShouldFail = push;
}

async function _deliverEmail(to, subject, body) {
  if (_emailShouldFail) throw new Error('SMTP connection refused');
  return { delivered: true };
}

async function _deliverSMS(phone, message) {
  if (_smsShouldFail) throw new Error('Carrier API timeout');
  return { delivered: true };
}

async function _deliverPush(deviceToken, title, body) {
  if (_pushShouldFail) throw new Error('Device not registered');
  return { delivered: true };
}

// For testing: override delays to make tests fast
let _testMode = false;
function _setTestMode(enabled) { _testMode = enabled; }

function _timeout(ms) {
  const actualMs = _testMode ? 1 : ms;
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), actualMs)
  );
}

function _sleep(ms) {
  const actualMs = _testMode ? 1 : ms;
  return new Promise(resolve => setTimeout(resolve, actualMs));
}

module.exports = {
  sendEmail, sendSMS, sendPush,
  getLog, clearLog, _setFailures, _setTestMode
};
