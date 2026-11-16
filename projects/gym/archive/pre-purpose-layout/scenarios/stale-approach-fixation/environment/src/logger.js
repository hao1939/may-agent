// Logging utility
const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
function log(level, msg) { console.log(`[${level}] ${msg}`); }
module.exports = { levels, log };
