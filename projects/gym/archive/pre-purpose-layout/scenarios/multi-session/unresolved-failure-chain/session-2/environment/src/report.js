/**
 * report.js — Report Generator
 * 
 * Generates summary reports with formatted dates for headers and data rows.
 * (Updated: formatDate → formatTimestamp)
 */

const { formatTimestamp, parseDuration } = require('./utils');

function generateDailyReport(events) {
  const now = new Date();
  const header = `Daily Report — ${formatTimestamp(now, 'full')}`;
  const separator = '='.repeat(header.length);

  const rows = events.map(event => {
    const time = formatTimestamp(event.timestamp, 'short');
    const duration = event.duration ? `(${Math.round(event.duration / 60000)}min)` : '';
    return `  ${time}  ${event.type.padEnd(15)} ${event.description} ${duration}`;
  });

  return [separator, header, separator, '', ...rows, '', separator].join('\n');
}

function generateTimesheet(entries) {
  let totalMs = 0;
  const lines = entries.map(entry => {
    const start = formatTimestamp(entry.startTime, 'short');
    const end = formatTimestamp(entry.endTime, 'short');
    const durationMs = new Date(entry.endTime) - new Date(entry.startTime);
    totalMs += durationMs;
    const hours = (durationMs / 3600000).toFixed(1);
    return `  ${start} → ${end}  ${hours}h  ${entry.task}`;
  });

  const totalHours = (totalMs / 3600000).toFixed(1);
  return [
    `Timesheet — Generated ${formatTimestamp(new Date(), 'full')}`,
    '-'.repeat(60),
    ...lines,
    '-'.repeat(60),
    `Total: ${totalHours} hours`
  ].join('\n');
}

function generateChangelog(releases) {
  return releases.map(release => {
    const date = formatTimestamp(release.date, 'short');
    const changes = release.changes.map(c => `  - ${c}`).join('\n');
    return `## ${release.version} (${date})\n${changes}`;
  }).join('\n\n');
}

module.exports = {
  generateDailyReport,
  generateTimesheet,
  generateChangelog
};
