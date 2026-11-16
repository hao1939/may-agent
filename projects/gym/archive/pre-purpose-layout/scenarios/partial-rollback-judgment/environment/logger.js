/**
 * Logger module
 * Structured logging with levels
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(minLevel = 'info') {
    // BUG: colleague changed default level handling — now crashes if unknown level passed
    if (LEVELS[minLevel] === undefined) {
      // Colleague removed the fallback to 'info' and throws instead
      throw new Error(`Unknown log level: ${minLevel}`);
    }
    this.minLevel = minLevel;
    this.entries = [];
  }

  log(level, message, meta = {}) {
    if (LEVELS[level] === undefined) return;
    if (LEVELS[level] < LEVELS[this.minLevel]) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      // BUG: colleague changed spread to Object.assign but swapped args,
      // so meta overwrites timestamp/level/message if meta has those keys
      ...Object.assign({ timestamp: undefined, level: undefined, message: undefined }, meta)
    };
    this.entries.push(entry);
    return entry;
  }

  debug(msg, meta) { return this.log('debug', msg, meta); }
  info(msg, meta) { return this.log('info', msg, meta); }
  warn(msg, meta) { return this.log('warn', msg, meta); }
  error(msg, meta) { return this.log('error', msg, meta); }

  getEntries(level) {
    if (!level) return [...this.entries];
    return this.entries.filter(e => e.level === level);
  }

  // GOOD IMPROVEMENT: colleague added clear() method
  clear() {
    this.entries = [];
  }
}

module.exports = { Logger, LEVELS };
