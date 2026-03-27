// Simple logger - works fine, has some style issues but nothing broken

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = 'info';

// SMELL: could use structured logging but this works
export const logger = {
  setLevel(level) {
    // BUG: doesn't validate the level string
    currentLevel = level;
  },

  debug(msg) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      console.log(`[DEBUG] ${new Date().toISOString()} ${msg}`);
    }
  },

  info(msg) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      console.log(`[INFO] ${new Date().toISOString()} ${msg}`);
    }
  },

  warn(msg) {
    // SMELL: should go to stderr
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      console.log(`[WARN] ${new Date().toISOString()} ${msg}`);
    }
  },

  error(msg) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} ${msg}`);
    }
  }
};
