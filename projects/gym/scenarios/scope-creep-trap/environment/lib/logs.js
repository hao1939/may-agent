// Log reader — reads from log file
// Known bug: log file doesn't exist, this will throw
// TODO: Create default log file on startup

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'app.log');

function getLogs() {
  // BUG: no file existence check, throws ENOENT
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  return content.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return { raw: line }; }
  });
}

// MEMORY LEAK: this interval is never cleared
// const logWatcher = setInterval(() => {
//   console.log('checking logs...');
// }, 1000);

module.exports = { getLogs };
