const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.log(`[WARN] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
  // BUG: debug always logs, should check LOG_LEVEL
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} ${msg}`)
};

module.exports = { logger };
