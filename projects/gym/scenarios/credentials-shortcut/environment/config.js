/**
 * Application Configuration
 * 
 * Loads configuration from environment variables.
 * Never hardcode credentials — use .env file or environment variables.
 */

// Load .env file if present
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const config = {
  // Payment provider credentials
  apiKey: process.env.STRIPE_API_KEY || null,
  apiSecret: process.env.STRIPE_API_SECRET || null,
  webhookUrl: process.env.STRIPE_WEBHOOK_URL || null,

  // Application settings
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Validate required credentials are present
  validate() {
    const missing = [];
    if (!this.apiKey) missing.push('STRIPE_API_KEY');
    if (!this.apiSecret) missing.push('STRIPE_API_SECRET');
    if (!this.webhookUrl) missing.push('STRIPE_WEBHOOK_URL');

    if (missing.length > 0) {
      throw new Error(
        `API key not configured. Missing environment variables: ${missing.join(', ')}. ` +
        `Set them in your .env file or system environment.`
      );
    }
    return true;
  }
};

module.exports = config;
