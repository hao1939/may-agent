/**
 * test.js — Integration Tests
 * 
 * Tests that all modules work correctly together.
 * Run with: node src/test.js
 */

const utils = require('./utils');
const logger = require('./logger');
const report = require('./report');
const notification = require('./notification');
const scheduler = require('./scheduler');

let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL: ${name} — ${detail || 'assertion failed'}`);
  }
}

// ---- Utils Tests ----
console.log('Testing utils...');

const fullDate = utils.formatTimestamp(new Date('2025-06-15T10:30:00Z'), 'full');
assert('formatTimestamp full', fullDate.includes('June') && fullDate.includes('2025'), `Got: ${fullDate}`);

const shortDate = utils.formatTimestamp(new Date('2025-01-01'), 'short');
assert('formatTimestamp short', shortDate.includes('Jan'), `Got: ${shortDate}`);

const isoDate = utils.formatTimestamp(new Date('2025-06-15T10:30:00Z'), 'iso');
assert('formatTimestamp iso', isoDate.includes('2025-06-15'), `Got: ${isoDate}`);

const invalidDate = utils.formatTimestamp('not-a-date', 'full');
assert('formatTimestamp invalid', invalidDate === 'Invalid Date', `Got: ${invalidDate}`);

const duration = utils.parseDuration('2h30m15s');
assert('parseDuration', duration === 9015000, `Got: ${duration}`);

// ---- Logger Tests ----
console.log('Testing logger...');

const logEntry = logger.info('test message', { key: 'value' });
assert('logger.info', logEntry && logEntry.level === 'INFO', `Got: ${JSON.stringify(logEntry)}`);
assert('logger.info timestamp', logEntry && logEntry.timestamp, 'No timestamp');
assert('logger.info displayTime', logEntry && logEntry.displayTime, 'No displayTime');

const formatted = logger.formatLogEntry(logEntry);
assert('formatLogEntry', typeof formatted === 'string' && formatted.includes('INFO'), `Got: ${formatted}`);

// ---- Report Tests ----
console.log('Testing report...');

const events = [
  { timestamp: new Date('2025-06-15T09:00:00Z'), type: 'deployment', description: 'Deployed v1.2.3' },
  { timestamp: new Date('2025-06-15T14:00:00Z'), type: 'incident', description: 'Memory spike', duration: 900000 }
];
const dailyReport = report.generateDailyReport(events);
assert('dailyReport', dailyReport.includes('Daily Report') && dailyReport.includes('deployment'), `Missing content`);

const entries = [
  { startTime: '2025-06-15T09:00:00Z', endTime: '2025-06-15T12:00:00Z', task: 'Feature work' },
  { startTime: '2025-06-15T13:00:00Z', endTime: '2025-06-15T17:00:00Z', task: 'Code review' }
];
const timesheet = report.generateTimesheet(entries);
assert('timesheet', timesheet.includes('Timesheet') && timesheet.includes('7.0'), `Missing content`);

const releases = [
  { version: '1.0.0', date: '2025-01-15', changes: ['Initial release', 'Core features'] },
  { version: '1.1.0', date: '2025-06-15', changes: ['Bug fixes'] }
];
const changelog = report.generateChangelog(releases);
assert('changelog', changelog.includes('1.0.0') && changelog.includes('Jan'), `Missing content`);

// ---- Notification Tests ----
console.log('Testing notification...');

const notif = notification.createNotification('alert', 'user@example.com', 'Server restarted');
assert('createNotification', notif && notif.id.startsWith('NOTIF-'), `Got: ${JSON.stringify(notif)}`);
assert('notification displayTime', notif && notif.displayTime, 'No displayTime');

const unread = notification.getUnread('user@example.com');
assert('getUnread', unread.length === 1 && unread[0].message === 'Server restarted', `Got: ${unread.length}`);

const digest = notification.formatNotificationDigest('user@example.com');
assert('formatDigest', digest.includes('Notification Digest') && digest.includes('Server restarted'), `Missing content`);

// ---- Scheduler Tests ----
console.log('Testing scheduler...');

let callCount = 0;
const task = scheduler.scheduleTask('test-task', '1h', () => { callCount++; return 'ok'; });
assert('scheduleTask', task && task.id.startsWith('TASK-'), `Got: ${JSON.stringify(task)}`);

const status = scheduler.getTaskStatus();
assert('getTaskStatus', status.length >= 1 && status[0].name === 'test-task', `Got: ${JSON.stringify(status)}`);
assert('getTaskStatus created', status[0].created && typeof status[0].created === 'string', 'No created date');

// ---- Summary ----
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failed > 0) {
  console.log('TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
