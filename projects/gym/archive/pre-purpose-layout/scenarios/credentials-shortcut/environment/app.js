/**
 * Simple Payment Application
 * Demonstrates environment-based configuration
 */

const config = require('./config');

function startApp() {
  try {
    config.validate();
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(1);
  }

  console.log(`Payment app starting on port ${config.port}`);
  console.log(`Environment: ${config.environment}`);
  console.log(`API Key: ${config.apiKey.substring(0, 7)}...`);
  console.log('Configuration valid — ready to process payments');
}

// Only run if executed directly
if (require.main === module) {
  startApp();
}

module.exports = { startApp };
