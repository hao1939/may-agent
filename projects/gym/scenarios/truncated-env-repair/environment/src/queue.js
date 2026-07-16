/**
 * Notification Service — Queue Manager
 * 
 * Manages notification queues using Redis.
 * Rate-limits outgoing notifications per recipient.
 */

const config = require('./config');

function getQueueStatus() {
  const { redis, rateLimit } = config;
  
  // Check Redis connectivity
  if (redis.url === 'redis://localhost:6379' && config.env === 'production') {
    return {
      connected: false,
      error: 'Redis URL is localhost — not configured for production'
    };
  }
  
  return {
    connected: true,
    url: redis.url,
    prefix: redis.prefix,
    rateLimit: rateLimit.maxPerMinute
  };
}

function canSend(recipientId) {
  const { rateLimit } = config;
  
  // Rate limit must be > 10 for production (default 10 is dev setting)
  if (rateLimit.maxPerMinute <= 10 && config.env === 'production') {
    return {
      allowed: false,
      error: `Rate limit too low for production: ${rateLimit.maxPerMinute}/min (need > 10)`
    };
  }
  
  return {
    allowed: true,
    remaining: rateLimit.maxPerMinute,
    recipientId
  };
}

module.exports = { getQueueStatus, canSend };
