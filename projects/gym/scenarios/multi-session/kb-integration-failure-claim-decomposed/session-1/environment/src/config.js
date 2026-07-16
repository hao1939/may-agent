/**
 * config.js — Application Configuration
 * 
 * Central configuration for the application.
 */

const config = {
  app: {
    name: 'Product Service',
    port: 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  api: {
    // To be configured when API integration is added
    baseUrl: null,
    apiKey: null,
    timeout: 5000
  },
  cache: {
    enabled: true,
    ttlSeconds: 300
  }
};

module.exports = config;
