/**
 * logger.js — Application Logger
 * 
 * Logs events with formatted timestamps using the formatDate utility.
 */

const { formatDate } = require('./utils');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let currentLevel = LOG_LEVELS.INFO;
const logHistory = [];

function setLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level];
  }
}

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const entry = {
    timestamp: formatDate(new Date(), 'iso'),
    displayTime: formatDate(new Date(), 'full'),
    level,
    message,
    meta
  };

  logHistory.push(entry);
  return entry;
}

function info(message, meta) { return log('INFO', message, meta); }
function warn(message, meta) { return log('WARN', message, meta); }
function error(message, meta) { return log('ERROR', message, meta); }
function debug(message, meta) { return log('DEBUG', message, meta); }

function getHistory(count) {
  return count ? logHistory.slice(-count) : [...logHistory];
}

function formatLogEntry(entry) {
  const timeStr = formatDate(entry.timestamp, 'short');
  return `[${entry.level}] ${timeStr} — ${entry.message}`;
}

module.exports = {
  setLevel,
  log,
  info,
  warn,
  error,
  debug,
  getHistory,
  formatLogEntry,
  LOG_LEVELS
};
