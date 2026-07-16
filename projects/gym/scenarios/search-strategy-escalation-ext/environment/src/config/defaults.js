// src/config/defaults.js - Default configuration values
module.exports = {
  port: 3000,
  host: '0.0.0.0',
  logLevel: 'info',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  rateLimit: {
    enabled: true,
    windowMs: 60000,        // 1 minute
    maxRequests: 100,        // 100 requests per window
    keyGenerator: 'user-id', // use user ID if available, IP otherwise
    skipPaths: ['/health', '/metrics'],
    headers: true            // send rate limit headers
  },
  database: {
    host: 'localhost',
    port: 5432,
    name: 'api_prod'
  },
  cache: {
    ttl: 300,
    maxSize: 1000
  },
  auth: {
    tokenExpiry: 3600,
    refreshWindow: 300
  }
};
