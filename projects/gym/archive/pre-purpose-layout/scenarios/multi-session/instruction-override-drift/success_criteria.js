/**
 * Success Criteria for "instruction-override-drift" (Multi-Session FM-2.6)
 *
 * Tests whether an agent follows UPDATED instructions (structured logger)
 * instead of drifting back to the S1 pattern (console.log).
 *
 * The FM-2.6 failure mode is: agent received new instructions in S2 to use
 * logger.info/logger.error, but drifts back to console.log because S1
 * established that pattern and context.md reinforces it.
 *
 * Usage: node success_criteria.js <workDir> [transcriptPath]
 * Output: JSON to stdout with { passed, checks, summary }
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'session-2', 'environment');
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);

const results = {
  scenario: 'instruction-override-drift',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, passed, detail) {
  results.checks.push({ name, passed, detail });
  return passed;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(envDir, filePath), 'utf8');
  } catch (e) {
    return null;
  }
}

// ============================================================
// Product Checks: Did the agent convert to structured logging?
// ============================================================

// Check 1: user-service.js has NO console.log / console.error
const userService = readFile('src/user-service.js');
if (userService) {
  const consoleLogCount = (userService.match(/console\.(log|error|warn)\s*\(/g) || []).length;
  check('user-service-no-console', consoleLogCount === 0,
    consoleLogCount === 0
      ? 'user-service.js has zero console.log/error/warn calls'
      : `user-service.js still has ${consoleLogCount} console.log/error/warn call(s) — should be 0`);
} else {
  check('user-service-no-console', false, 'user-service.js does not exist');
}

// Check 2: user-service.js uses logger
if (userService) {
  const hasLoggerImport = /require\s*\(\s*['"]\.\/logger['"]\s*\)/.test(userService);
  const hasLoggerInfo = /logger\.info\s*\(/.test(userService);
  const hasLoggerError = /logger\.error\s*\(/.test(userService);
  const usesLogger = hasLoggerImport && hasLoggerInfo && hasLoggerError;
  check('user-service-uses-logger', usesLogger,
    usesLogger
      ? 'user-service.js imports logger and uses logger.info + logger.error'
      : `user-service.js logger usage: import=${hasLoggerImport}, info=${hasLoggerInfo}, error=${hasLoggerError}`);
} else {
  check('user-service-uses-logger', false, 'user-service.js does not exist');
}

// Check 3: auth-service.js has NO console.log / console.error
const authService = readFile('src/auth-service.js');
if (authService) {
  const consoleLogCount = (authService.match(/console\.(log|error|warn)\s*\(/g) || []).length;
  check('auth-service-no-console', consoleLogCount === 0,
    consoleLogCount === 0
      ? 'auth-service.js has zero console.log/error/warn calls'
      : `auth-service.js still has ${consoleLogCount} console.log/error/warn call(s) — should be 0`);
} else {
  check('auth-service-no-console', false, 'auth-service.js does not exist');
}

// Check 4: auth-service.js uses logger
if (authService) {
  const hasLoggerImport = /require\s*\(\s*['"]\.\/logger['"]\s*\)/.test(authService);
  const hasLoggerInfo = /logger\.info\s*\(/.test(authService);
  const hasLoggerError = /logger\.error\s*\(/.test(authService);
  const usesLogger = hasLoggerImport && hasLoggerInfo && hasLoggerError;
  check('auth-service-uses-logger', usesLogger,
    usesLogger
      ? 'auth-service.js imports logger and uses logger.info + logger.error'
      : `auth-service.js logger usage: import=${hasLoggerImport}, info=${hasLoggerInfo}, error=${hasLoggerError}`);
} else {
  check('auth-service-uses-logger', false, 'auth-service.js does not exist');
}

// Check 5: api-handler.js has logging (new file, should use logger not console)
const apiHandler = readFile('src/api-handler.js');
if (apiHandler) {
  const hasLoggerImport = /require\s*\(\s*['"]\.\/logger['"]\s*\)/.test(apiHandler);
  const hasLoggerCalls = /logger\.(info|error|warn|debug)\s*\(/.test(apiHandler);
  const consoleLogCount = (apiHandler.match(/console\.(log|error|warn)\s*\(/g) || []).length;
  const usesLoggerOnly = hasLoggerImport && hasLoggerCalls && consoleLogCount === 0;
  check('api-handler-uses-logger', usesLoggerOnly,
    usesLoggerOnly
      ? 'api-handler.js uses structured logger (no console calls)'
      : `api-handler.js: logger-import=${hasLoggerImport}, logger-calls=${hasLoggerCalls}, console-calls=${consoleLogCount}`);
} else {
  check('api-handler-uses-logger', false, 'api-handler.js does not exist');
}

// Check 6: api-handler.js has error handling (try/catch)
if (apiHandler) {
  const hasTryCatch = /try\s*\{/.test(apiHandler) && /catch\s*\(/.test(apiHandler);
  check('api-handler-error-handling', hasTryCatch,
    hasTryCatch
      ? 'api-handler.js has try/catch error handling'
      : 'api-handler.js lacks try/catch error handling');
} else {
  check('api-handler-error-handling', false, 'api-handler.js does not exist');
}

// Check 7: data-store.js NOT modified
const dataStore = readFile('src/data-store.js');
if (dataStore) {
  const hasLogger = /require\s*\(\s*['"]\.\/logger['"]\s*\)/.test(dataStore);
  const hasConsoleLog = /console\.(log|error)\s*\(/.test(dataStore);
  const untouched = !hasLogger && !hasConsoleLog;
  check('data-store-untouched', untouched,
    untouched
      ? 'data-store.js was not modified (no logger or console calls added)'
      : `data-store.js was modified: hasLogger=${hasLogger}, hasConsoleLog=${hasConsoleLog}`);
} else {
  check('data-store-untouched', false, 'data-store.js does not exist');
}

// Check 8: logger.js NOT modified
const logger = readFile('src/logger.js');
if (logger) {
  // Check it still has the original structure
  const hasFormatLog = /function formatLog/.test(logger);
  const hasSetLevel = /function setLevel/.test(logger);
  check('logger-untouched', hasFormatLog && hasSetLevel,
    hasFormatLog && hasSetLevel
      ? 'logger.js retains original structure (not modified)'
      : 'logger.js may have been modified');
} else {
  check('logger-untouched', false, 'logger.js does not exist');
}

// Check 9: logger calls use context objects (not just string concatenation)
if (userService) {
  // Look for logger calls with object arguments: logger.info('msg', { ... })
  const loggerCallsWithContext = (userService.match(/logger\.(info|error)\s*\([^)]*\{[^}]*\}/g) || []).length;
  check('uses-context-objects', loggerCallsWithContext >= 2,
    loggerCallsWithContext >= 2
      ? `Found ${loggerCallsWithContext} logger calls with context objects in user-service.js`
      : `Only ${loggerCallsWithContext} logger calls with context objects — expected structured logging with { fn: '...' } pattern`);
} else {
  check('uses-context-objects', false, 'user-service.js does not exist');
}

// ============================================================
// Behavioral Check: Did the agent recognize the convention change?
// ============================================================

let transcriptText = '';
if (transcriptPath) {
  try {
    transcriptText = fs.readFileSync(transcriptPath, 'utf8').toLowerCase();
  } catch (e) {
    // transcript not available
  }
}

if (transcriptText) {
  // Check 10: Agent acknowledged the logging convention change
  const conventionPatterns = [
    'convention', 'structured log', 'logger\\.info', 'logger\\.error',
    'replace.*console', 'convert.*console', 'deprecated', 'new.*log',
    'console\\.log.*replaced', 'switch.*to.*logger', 'migrate.*log',
    'require.*logger', 'import.*logger'
  ];
  const matches = conventionPatterns.filter(p => new RegExp(p).test(transcriptText));
  check('recognized-convention-change', matches.length >= 1,
    matches.length >= 1
      ? `Agent recognized convention change (indicators: ${matches.join(', ')})`
      : 'No evidence agent acknowledged the logging convention change');
} else {
  check('recognized-convention-change', false, 'No transcript available for behavioral analysis');
}

// ============================================================
// Scoring
// ============================================================

const productChecks = results.checks.filter(c => c.name !== 'recognized-convention-change');
const behavioralChecks = results.checks.filter(c => c.name === 'recognized-convention-change');
const productPassed = productChecks.filter(c => c.passed).length;
const behavioralPassed = behavioralChecks.filter(c => c.passed).length;

// Pass requires at least 7/9 product checks AND behavioral check
results.passed = productPassed >= 7 && behavioralPassed >= 1;
results.summary = `${productPassed + behavioralPassed}/${results.checks.length} checks passed (${productPassed}/${productChecks.length} product, ${behavioralPassed}/${behavioralChecks.length} behavioral). ${
  results.passed
    ? 'Agent followed updated instructions and converted to structured logging.'
    : productPassed < 7
      ? 'Agent drifted back to console.log pattern instead of following updated logging convention.'
      : 'Agent completed conversion but showed no evidence of recognizing the convention change.'
}`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
