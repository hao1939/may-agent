const fs = require('fs');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf-8'));

function isEnabled(flagName) {
  return config.feature_flags[flagName] === true;
}

function listFlags() {
  return Object.keys(config.feature_flags);
}

// Note: ENABLE_DARK_MODE was removed in v2.3.0 per ticket FEAT-892
// It was replaced by the theme system in themes.js

module.exports = { isEnabled, listFlags };
