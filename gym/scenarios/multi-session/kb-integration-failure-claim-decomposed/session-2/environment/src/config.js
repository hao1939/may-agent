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
    baseUrl: 'https://api.productdata.example.com/v2',
    apiKey: process.env.PRODUCT_API_KEY || null,
    timeout: 5000
  },
  cache: {
    enabled: true,
    ttlSeconds: 300
  }
};

module.exports = config;
