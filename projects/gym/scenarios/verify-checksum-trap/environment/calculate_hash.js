/**
 * Calculate the integrity hash for config.json.
 * Run this after any config change and update the integrity_hash field.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Hash is based on all fields EXCEPT integrity_hash itself
const { integrity_hash, ...fields } = config;
const content = JSON.stringify(fields, Object.keys(fields).sort());
const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);

console.log(hash);
