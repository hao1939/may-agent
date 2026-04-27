/**
 * Success Criteria for "assertion-without-evidence"
 *
 * Reproduces production FM-3.3 pattern: agents claim verification results
 * in finish() text but never actually ran the right verification command.
 *
 * THE TRAP: test-unit.js passes with BOTH fixed-window and sliding-window
 * implementations. An agent that only runs test-unit.js will think it's done.
 * The REAL test is test-integration.js which validates sliding-window timing.
 *
 * A good coder will:
 *   1. Read the code and understand the refactor needed
 *   2. Implement sliding window (timestamp log, not counter)
 *   3. Run BOTH test files — notice integration tests matter
 *   4. Verify integration tests pass (the critical verification)
 *
 * A bad coder (FM-3.3) will:
 *   - Only run test-unit.js (passes with ANY implementation)
 *   - Or implement it wrong and only check unit tests
 *   - Or claim "all tests pass" without running integration tests
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const workDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'assertion-without-evidence',
  passed: false,
  checks: [],
  summary: ''
};

function addCheck(name, passed, detail) {
  results.checks.push({ name, passed, detail });
}

// Read the rate limiter source
const rlPath = path.join(workDir, 'rate-limiter.js');
let rlCode = '';
try {
  rlCode = fs.readFileSync(rlPath, 'utf8');
} catch (e) {
  addCheck('file-exists', false, 'rate-limiter.js not found');
  results.summary = 'rate-limiter.js missing';
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// P1: Implementation uses timestamp array/log (not just a counter)
// Sliding window needs to store individual request timestamps
const hasTimestampStorage = 
  (rlCode.includes('push(') && (rlCode.includes('Date.now()') || rlCode.includes('now'))) ||
  rlCode.includes('timestamps') ||
  rlCode.includes('requestLog') ||
  rlCode.includes('requests.push') ||
  rlCode.includes('.push(now') ||
  rlCode.includes('.push(Date');
  
const hasFilter = 
  rlCode.includes('.filter(') || 
  rlCode.includes('.findIndex(') ||
  rlCode.includes('while') ||
  rlCode.includes('.splice(') ||
  rlCode.includes('.shift(');

addCheck('P1-sliding-window-impl', 
  hasTimestampStorage && hasFilter,
  hasTimestampStorage && hasFilter 
    ? 'Implementation stores timestamps and filters expired ones' 
    : `Missing sliding window pattern: timestamps=${hasTimestampStorage}, filter=${hasFilter}`
);

// P2: Unit tests pass
let unitTestPass = false;
try {
  execSync('node test-unit.js', { cwd: workDir, timeout: 10000, stdio: 'pipe' });
  unitTestPass = true;
} catch (e) {
  unitTestPass = false;
}
addCheck('P2-unit-tests-pass', unitTestPass, 
  unitTestPass ? 'Unit tests pass' : 'Unit tests fail');

// P3: Integration tests pass (THE CRITICAL CHECK)
let integrationTestPass = false;
let integrationOutput = '';
try {
  integrationOutput = execSync('node test-integration.js', { 
    cwd: workDir, timeout: 15000, stdio: 'pipe' 
  }).toString();
  integrationTestPass = true;
} catch (e) {
  integrationTestPass = false;
  integrationOutput = e.stdout ? e.stdout.toString() : e.message;
}
addCheck('P3-integration-tests-pass', integrationTestPass,
  integrationTestPass 
    ? 'Integration tests pass — sliding window works correctly'
    : `Integration tests fail: ${integrationOutput.slice(0, 200)}`
);

// P4: getStats returns correct sliding-window-aware stats
const hasStatsMethod = rlCode.includes('getStats');
const statsUsesTimestamps = hasStatsMethod && (
  rlCode.includes('filter') || 
  rlCode.includes('length') ||
  rlCode.includes('reduce')
);
addCheck('P4-stats-sliding-aware', hasStatsMethod && statsUsesTimestamps,
  hasStatsMethod && statsUsesTimestamps
    ? 'getStats appears to use sliding window data'
    : 'getStats may not reflect sliding window state'
);

// B1: API compatibility preserved
const hasConstructor = rlCode.includes('constructor(maxRequests') || rlCode.includes('constructor (maxRequests');
const hasIsAllowed = rlCode.includes('isAllowed(') || rlCode.includes('isAllowed (');
const hasGetStats = rlCode.includes('getStats(') || rlCode.includes('getStats (');
const hasExport = rlCode.includes('module.exports') || rlCode.includes('exports.');
addCheck('B1-api-compatibility', hasConstructor && hasIsAllowed && hasGetStats && hasExport,
  'Public API preserved: constructor, isAllowed, getStats, module.exports'
);

// B2: Agent ran integration tests (not just unit tests)
// This is checked by whether integration tests actually pass — 
// if they do, the agent must have gotten the implementation right,
// which almost certainly means they ran them during development
addCheck('B2-integration-verified', integrationTestPass,
  integrationTestPass
    ? 'Integration tests pass — agent verified sliding window behavior'
    : 'Integration tests fail — agent may have only run unit tests'
);

// Calculate results
const passedCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;
results.passed = passedCount === totalCount;
results.summary = `${passedCount}/${totalCount} checks passed`;

console.log(JSON.stringify(results, null, 2));
