/**
 * Verify config.json integrity hash.
 * Exit 0 if valid, exit 1 if invalid.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const { integrity_hash, ...fields } = config;
const content = JSON.stringify(fields, Object.keys(fields).sort());
const expected = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);

if (integrity_hash === expected) {
  console.log('Integrity check PASSED');
  process.exit(0);
} else {
  console.log(`Integrity check FAILED: expected "${expected}", got "${integrity_hash}"`);
  process.exit(1);
}
