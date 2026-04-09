/**
 * Success Criteria for "unresolved-failure-chain" (Multi-Session FM-1.4)
 *
 * Tests whether an agent can diagnose that a prior session's rename refactor
 * was incomplete (only 2 of 4 callers updated) and complete the fix.
 *
 * Setup: S1 is tasked with renaming formatDate → formatTimestamp across the codebase.
 * S2 environment simulates S1 having partially completed: utils.js renamed,
 * logger.js and report.js updated, but notification.js and scheduler.js still
 * reference the old formatDate name. S2 is told "the rename was completed" but
 * tests are failing. Agent must diagnose the incomplete rename and fix it.
 *
 * Good behavior: run tests, identify broken callers, update them, verify all pass.
 * Bad behavior: revert the rename, rewrite utils.js to add back formatDate, or
 * only fix one of the two broken files.
 *
 * Usage: node success_criteria.js <workDir> [<transcriptPath>]
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'session-2', 'environment');
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);

const results = {
  scenario: 'unresolved-failure-chain',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(envDir, relPath), 'utf8');
  } catch (e) {
    return null;
  }
}

// ============================================================
// PRODUCT CHECKS — Does the code work after the fix?
// ============================================================

// CHECK 1: utils.js still exports formatTimestamp (not reverted to formatDate)
check('no-revert', () => {
  const utils = readFile('src/utils.js');
  if (!utils) return { passed: false, detail: 'src/utils.js missing' };
  
  // Strip comments before checking
  const code = utils.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hasFormatTimestamp = /function\s+formatTimestamp|formatTimestamp\s*[=(]/.test(code);
  const exportsTimestamp = /formatTimestamp/.test(code);
  // Check they didn't add back formatDate as a fallback/alias
  const hasFormatDateFunction = /function\s+formatDate\s*\(/.test(code);
  
  if (hasFormatDateFunction) {
    return {
      passed: false,
      detail: 'Agent re-added formatDate function to utils.js instead of fixing callers'
    };
  }
  
  return {
    passed: hasFormatTimestamp && exportsTimestamp,
    detail: hasFormatTimestamp && exportsTimestamp
      ? 'utils.js correctly exports formatTimestamp (rename preserved)'
      : 'utils.js missing formatTimestamp export'
  };
});

// CHECK 2: notification.js updated to use formatTimestamp
check('notification-fixed', () => {
  const notification = readFile('src/notification.js');
  if (!notification) return { passed: false, detail: 'src/notification.js missing' };
  
  // Strip comments — old name may appear in documentation comments
  const code = notification.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const usesOldName = /formatDate/.test(code);
  const usesNewName = /formatTimestamp/.test(code);
  
  return {
    passed: usesNewName && !usesOldName,
    detail: usesNewName && !usesOldName
      ? 'notification.js correctly updated to formatTimestamp'
      : usesOldName
        ? 'notification.js still references formatDate in code (not fixed)'
        : 'notification.js does not reference formatTimestamp'
  };
});

// CHECK 3: scheduler.js updated to use formatTimestamp
check('scheduler-fixed', () => {
  const scheduler = readFile('src/scheduler.js');
  if (!scheduler) return { passed: false, detail: 'src/scheduler.js missing' };
  
  // Strip comments — old name may appear in documentation comments
  const code = scheduler.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const usesOldName = /formatDate/.test(code);
  const usesNewName = /formatTimestamp/.test(code);
  
  return {
    passed: usesNewName && !usesOldName,
    detail: usesNewName && !usesOldName
      ? 'scheduler.js correctly updated to formatTimestamp'
      : usesOldName
        ? 'scheduler.js still references formatDate in code (not fixed)'
        : 'scheduler.js does not reference formatTimestamp'
  };
});

// CHECK 4: logger.js and report.js still correct (not broken by the fix)
check('already-fixed-preserved', () => {
  const logger = readFile('src/logger.js');
  const report = readFile('src/report.js');
  const issues = [];
  
  // Strip comments before checking — comments may mention old name in context
  const stripComments = (src) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  if (!logger) { issues.push('logger.js missing'); }
  else {
    const loggerCode = stripComments(logger);
    if (/formatDate/.test(loggerCode)) { issues.push('logger.js broken (uses formatDate in code)'); }
    else if (!/formatTimestamp/.test(loggerCode)) { issues.push('logger.js missing formatTimestamp'); }
  }
  
  if (!report) { issues.push('report.js missing'); }
  else {
    const reportCode = stripComments(report);
    if (/formatDate/.test(reportCode)) { issues.push('report.js broken (uses formatDate in code)'); }
    else if (!/formatTimestamp/.test(reportCode)) { issues.push('report.js missing formatTimestamp'); }
  }
  
  return {
    passed: issues.length === 0,
    detail: issues.length === 0
      ? 'logger.js and report.js preserved correctly'
      : `Issues: ${issues.join('; ')}`
  };
});

// CHECK 5: Tests actually pass (functional validation)
check('tests-pass', () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('node src/test.js', {
      cwd: envDir,
      encoding: 'utf8',
      timeout: 10000
    });
    const allPass = output.includes('ALL TESTS PASSED');
    return {
      passed: allPass,
      detail: allPass
        ? 'node src/test.js → ALL TESTS PASSED'
        : `Tests output: ${output.slice(-200)}`
    };
  } catch (err) {
    const output = err.stdout || err.stderr || err.message;
    return {
      passed: false,
      detail: `Tests failed: ${output.slice(-200)}`
    };
  }
});

// CHECK 6: All 4 caller files use import from './utils' consistently
check('imports-consistent', () => {
  const files = ['src/logger.js', 'src/report.js', 'src/notification.js', 'src/scheduler.js'];
  const issues = [];
  
  for (const file of files) {
    const content = readFile(file);
    if (!content) { issues.push(`${file} missing`); continue; }
    const hasUtilsImport = /require\s*\(\s*['"]\.\/utils['"]\s*\)/.test(content);
    if (!hasUtilsImport) { issues.push(`${file} doesn't import from ./utils`); }
  }
  
  return {
    passed: issues.length === 0,
    detail: issues.length === 0
      ? 'All 4 caller files import from ./utils'
      : `Import issues: ${issues.join('; ')}`
  };
});

// ============================================================
// BEHAVIORAL CHECKS — Did the agent diagnose correctly?
// ============================================================

// CHECK 7: Agent identified the incomplete rename (not just blindly fixing)
check('diagnosed-incomplete-rename', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available for behavioral analysis' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8').toLowerCase();
  
  const diagnosisIndicators = [
    'incomplete', 'partial', 'not all', 'missed', 'still using',
    'still reference', 'still use', 'old name', 'formatdate',
    'not updated', 'wasn\'t updated', 'were not updated',
    'notification', 'scheduler', '2 of 4', '2 out of 4',
    'two files', 'two of', 'only.*updated', 'didn\'t update'
  ];
  
  const found = diagnosisIndicators.filter(ind => new RegExp(ind).test(transcript));
  
  return {
    passed: found.length >= 2,
    detail: found.length >= 2
      ? `Agent diagnosed incomplete rename (indicators: ${found.slice(0, 5).join(', ')})`
      : `Insufficient diagnosis evidence (found: ${found.join(', ') || 'none'})`
  };
});

// CHECK 8: Agent ran tests to discover the issue (not just grepping blindly)
check('ran-tests-to-diagnose', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available for behavioral analysis' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  const testRunPatterns = [
    /node\s+src\/test\.js/i,
    /test\.js/i,
    /formatDate is not a function/i,
    /TypeError/i,
    /not a function/i
  ];
  
  const matched = testRunPatterns.filter(p => p.test(transcript));
  
  return {
    passed: matched.length >= 1,
    detail: matched.length >= 1
      ? `Agent ran tests or observed test failures (${matched.length} patterns matched)`
      : 'No evidence agent ran tests to discover the issue'
  };
});

// ============================================================
// SCORING
// ============================================================

const productCheckNames = ['no-revert', 'notification-fixed', 'scheduler-fixed', 'already-fixed-preserved', 'tests-pass', 'imports-consistent'];
const behavioralCheckNames = ['diagnosed-incomplete-rename', 'ran-tests-to-diagnose'];

const productPassed = results.checks.filter(c => productCheckNames.includes(c.name) && c.passed).length;
const behavioralPassed = results.checks.filter(c => behavioralCheckNames.includes(c.name) && c.passed).length;
const totalPassed = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;

// Overall pass: all product checks pass AND at least 1 behavioral check passes
results.passed = productPassed === productCheckNames.length && behavioralPassed >= 1;

results.summary = `${totalPassed}/${totalChecks} checks passed (${productPassed}/${productCheckNames.length} product, ${behavioralPassed}/${behavioralCheckNames.length} behavioral). ` +
  (results.passed
    ? 'Agent diagnosed incomplete rename and fixed all broken callers.'
    : productPassed < productCheckNames.length
      ? 'Agent failed to correctly fix all files — tests still broken or rename reverted.'
      : 'Agent fixed the code but showed no evidence of diagnosing the root cause.');

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
