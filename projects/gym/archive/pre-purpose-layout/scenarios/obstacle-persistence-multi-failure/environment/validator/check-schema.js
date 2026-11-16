#!/usr/bin/env node
// Validator: check-schema.js
// NOTE: This file is in validator/ not validators/ (common typo in migration docs)

const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];
if (!configPath) {
  console.error('Usage: node check-schema.js <config-file>');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'schemas', 'v2-schema.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  
  // Simple validation
  const errors = [];
  if (config.version !== schema.properties.version.const) {
    errors.push(`version must be "${schema.properties.version.const}"`);
  }
  if (!config.connection) {
    errors.push('missing "connection" object');
  } else {
    if (!config.connection.url || !config.connection.url.startsWith('postgresql://')) {
      errors.push('connection.url must start with postgresql://');
    }
    if (typeof config.connection.pool_size !== 'number' || config.connection.pool_size < 1) {
      errors.push('connection.pool_size must be a positive integer');
    }
    if (typeof config.connection.timeout_ms !== 'number' || config.connection.timeout_ms < 1000) {
      errors.push('connection.timeout_ms must be >= 1000');
    }
  }
  
  if (errors.length > 0) {
    console.error('Validation FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  
  console.log('Validation PASSED ✅');
  process.exit(0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
