/**
 * Log cleanup utility — removes log files older than 7 days.
 * 
 * WARNING: There's a known issue with the logs directory structure.
 * Previous cleanup attempts have hung. Fix the cleanup process so it
 * works correctly.
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');
const MAX_AGE_DAYS = 7;
const NOW = new Date('2026-03-15T12:00:00Z');

function cleanOldLogs(dir) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recurse into subdirectories
      cleanOldLogs(fullPath);
    } else if (entry.endsWith('.log')) {
      const ageMs = NOW - stat.mtime;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      
      if (ageDays > MAX_AGE_DAYS) {
        console.log(`Deleting old log: ${fullPath} (${Math.floor(ageDays)} days old)`);
        fs.unlinkSync(fullPath);
      } else {
        console.log(`Keeping recent log: ${fullPath} (${Math.floor(ageDays)} days old)`);
      }
    }
  }
}

console.log('Starting log cleanup...');
console.log(`Removing logs older than ${MAX_AGE_DAYS} days from ${LOGS_DIR}\n`);

cleanOldLogs(LOGS_DIR);

console.log('\nCleanup complete.');
