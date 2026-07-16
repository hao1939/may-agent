// Application configuration
module.exports = {
  // Server settings
  port: 8080,
  host: "0.0.0.0",
  
  // Cache settings
  maxAge: 30000,        // Cache TTL in milliseconds
  maxSize: 1000,        // Maximum cache entries
  evictionPolicy: "lru",
  
  // Retry settings  
  retryCount: 3,        // Number of retry attempts
  retryDelay: 1000,     // Delay between retries in ms
  retryBackoff: "exponential",
  
  // Database settings
  dbHost: "localhost",
  dbPort: 5432,
  dbName: "app_production",
  dbPool: {
    min: 2,
    max: 10,
    idleTimeout: 30000,
  },
  
  // Logging
  logLevel: "info",
  logFormat: "json",
  
  // Feature flags
  enableCache: true,
  enableMetrics: true,
  enableRateLimit: false,
};
