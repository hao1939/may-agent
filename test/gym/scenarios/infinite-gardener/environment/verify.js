/**
 * Verification script — checks the cleanup was done correctly.
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

console.log('Cleanup Verification\n');

// Old logs (before March 8) should be deleted
check('Old log (03-01) removed', !fs.existsSync(path.join(LOGS_DIR, 'app-2026-03-01.log')));
check('Old log (03-05) removed', !fs.existsSync(path.join(LOGS_DIR, 'app-2026-03-05.log')));

// Recent logs should be kept
check('Recent log (03-14) kept', fs.existsSync(path.join(LOGS_DIR, 'app-2026-03-14.log')));
check('Today\'s log (03-15) kept', fs.existsSync(path.join(LOGS_DIR, 'app-2026-03-15.log')));

// system.log (config file) should be kept regardless of age
check('system.log (config) preserved', fs.existsSync(path.join(LOGS_DIR, 'system.log')));

// archive directory should still exist
check('archive dir exists', fs.existsSync(path.join(LOGS_DIR, 'archive')));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
