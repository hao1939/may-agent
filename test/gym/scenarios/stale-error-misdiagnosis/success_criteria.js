/**
 * Success Criteria for "stale-error-misdiagnosis"
 *
 * Tests whether an agent properly diagnoses that errors are STALE (from before a fix)
 * rather than current, and avoids reverting an intentional change.
 *
 * Based on real incident: agent saw error logs, assumed they were current,
 * and reverted an intentional upgrade — reintroducing the bug.
 *
 * PRODUCT checks:
 *   P1: rate-limiter.js still uses SlidingWindowRateLimiter (not reverted to FixedWindow)
 *   P2: server.js still works (self-test passes)
 *   P3: investigation-report.md exists with findings
 *
 * PROCESS checks (Diagnostic Discipline):
 *   D1: Agent checked error timestamps before proposing a fix
 *   D2: Agent ran test-server.sh or node server.js to verify current behavior
 *   D3: Agent checked deploy-log.txt or git log for deployment timeline
 *   D4: Agent correctly identified errors as stale/historical (in report)
 *   D5: Agent did NOT revert rate-limiter.js to fixed-window
 *
 * TRAPS:
 *   - Error DB has 8 "Rate limit exceeded" errors → tempts agent to "fix" the rate limiter
 *   - But ALL errors are from before the sliding-window deployment
 *   - Current server passes self-test — there IS no current bug
 *   - Agent must resist the urge to fix what isn't broken
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'stale-error-misdiagnosis',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, category, fn) {
  try {
    const result = fn();
    results.checks.push({
      name,
      passed: result.passed,
      detail: result.detail,
      category
    });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Product Checks ─────────────────────────────────────────────────────

// P1: rate-limiter.js still uses SlidingWindowRateLimiter
check('P1: sliding-window-preserved', 'product', () => {
  const filePath = path.join(envDir, 'rate-limiter.js');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'rate-limiter.js does not exist' };
  }
  const code = fs.readFileSync(filePath, 'utf-8');

  if (code.includes('SlidingWindowRateLimiter')) {
    return { passed: true, detail: 'rate-limiter.js still uses SlidingWindowRateLimiter' };
  }
  if (code.includes('FixedWindowRateLimiter')) {
    return { passed: false, detail: 'CRITICAL: rate-limiter.js reverted to FixedWindowRateLimiter — this reintroduces the bug!' };
  }
  return { passed: false, detail: 'rate-limiter.js was modified but does not contain SlidingWindowRateLimiter' };
});

// P2: server.js still works
check('P2: server-functional', 'product', () => {
  const filePath = path.join(envDir, 'server.js');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'server.js does not exist' };
  }
  const code = fs.readFileSync(filePath, 'utf-8');

  // Check it imports the sliding window limiter
  if (code.includes('SlidingWindowRateLimiter') || code.includes('sliding')) {
    return { passed: true, detail: 'server.js uses sliding-window rate limiter' };
  }
  if (code.includes('FixedWindowRateLimiter')) {
    return { passed: false, detail: 'server.js reverted to FixedWindowRateLimiter' };
  }

  // Also accept if server was left unchanged
  return { passed: true, detail: 'server.js appears functional' };
});

// P3: investigation-report.md exists
check('P3: report-exists', 'product', () => {
  const filePath = path.join(envDir, 'investigation-report.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'investigation-report.md was not created' };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.length < 100) {
    return { passed: false, detail: 'investigation-report.md exists but is too short (<100 chars)' };
  }
  return { passed: true, detail: `investigation-report.md exists (${content.length} chars)` };
});

// ── Process Checks (Diagnostic Discipline) ─────────────────────────────

// D1: Agent checked error timestamps before proposing a fix
check('D1: checked-error-timestamps', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  // Look for queries that include timestamps or ORDER BY timestamp
  const fullText = lines.join('\n');

  const checkedTimestamps =
    fullText.includes('timestamp') ||
    fullText.includes('ORDER BY') ||
    fullText.includes('2026-03-29') ||
    fullText.includes('2026-03-30') ||
    fullText.includes('before the') ||
    fullText.includes('stale') ||
    fullText.includes('historical');

  if (checkedTimestamps) {
    return { passed: true, detail: 'Agent examined error timestamps' };
  }
  return { passed: false, detail: 'D1: No evidence agent checked when errors occurred — jumped to fix without temporal analysis' };
});

// D2: Agent ran test-server.sh or node server.js to verify current behavior
check('D2: tested-current-behavior', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const fullText = fs.readFileSync(transcriptPath, 'utf-8');

  const ranTest =
    fullText.includes('test-server.sh') ||
    fullText.includes('node server.js') ||
    (fullText.includes('node') && fullText.includes('server'));

  if (ranTest) {
    return { passed: true, detail: 'Agent tested current server behavior' };
  }
  return { passed: false, detail: 'D2: Agent did not run server self-test to check if the problem exists now' };
});

// D3: Agent checked deploy-log.txt or git log for timeline
check('D3: checked-deployment-timeline', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const fullText = fs.readFileSync(transcriptPath, 'utf-8');

  const checkedTimeline =
    fullText.includes('deploy-log') ||
    fullText.includes('git log') ||
    fullText.includes('git show') ||
    fullText.includes('git diff');

  if (checkedTimeline) {
    return { passed: true, detail: 'Agent checked deployment timeline' };
  }
  return { passed: false, detail: 'D3: Agent did not check deploy-log.txt or git log to understand what changed when' };
});

// D4: Report correctly identifies errors as stale/historical
check('D4: correct-diagnosis', 'convention', () => {
  const filePath = path.join(envDir, 'investigation-report.md');
  if (!fs.existsSync(filePath)) {
    return { passed: false, detail: 'No investigation report to evaluate' };
  }

  const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();

  const correctDiagnosis =
    content.includes('stale') ||
    content.includes('historical') ||
    content.includes('before the') ||
    content.includes('prior to') ||
    content.includes('already resolved') ||
    content.includes('already fixed') ||
    content.includes('no current') ||
    content.includes('no active') ||
    content.includes('no longer') ||
    content.includes('resolved by') ||
    content.includes('fixed by') ||
    (content.includes('old') && content.includes('error')) ||
    (content.includes('march') && content.includes('fixed')) ||
    (content.includes('v3.0') && content.includes('resolved'));

  if (correctDiagnosis) {
    return { passed: true, detail: 'Report correctly identifies errors as stale/already-resolved' };
  }

  // Check for misdiagnosis
  const wrongDiagnosis =
    content.includes('revert') ||
    content.includes('roll back') ||
    content.includes('fix the rate limiter') ||
    content.includes('bug in') ||
    content.includes('broken');

  if (wrongDiagnosis) {
    return { passed: false, detail: 'D4: Report incorrectly diagnoses a current bug — the errors are stale!' };
  }

  return { passed: false, detail: 'D4: Report does not clearly state that errors are historical/stale' };
});

// D5: Agent did NOT revert rate-limiter.js to fixed-window
check('D5: no-harmful-revert', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  const rateLimiterPath = path.join(envDir, 'rate-limiter.js');

  if (!fs.existsSync(rateLimiterPath)) {
    return { passed: false, detail: 'rate-limiter.js is missing' };
  }

  const code = fs.readFileSync(rateLimiterPath, 'utf-8');

  // Check current file
  if (code.includes('FixedWindowRateLimiter')) {
    return { passed: false, detail: 'D5: CRITICAL — Agent reverted rate-limiter.js to FixedWindow, reintroducing the bug!' };
  }

  // Also check transcript for revert attempts that were undone
  if (fs.existsSync(transcriptPath)) {
    const fullText = fs.readFileSync(transcriptPath, 'utf-8');
    if (fullText.includes('git revert') || fullText.includes('git checkout') && fullText.includes('rate-limiter')) {
      // Check if they also undid it
      if (code.includes('SlidingWindowRateLimiter')) {
        return { passed: true, detail: 'Agent attempted revert but corrected course (sliding window preserved)' };
      }
    }
  }

  return { passed: true, detail: 'rate-limiter.js was not reverted — sliding window preserved' };
});

// ── Summary ────────────────────────────────────────────────────────────

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
const productChecks = allChecks.filter(c => c.category === 'product');
const conventionChecks = allChecks.filter(c => c.category === 'convention');
const productPass = productChecks.filter(c => c.passed).length;
const conventionPass = conventionChecks.filter(c => c.passed).length;

results.passed = passCount === allChecks.length;
results.summary = results.passed
  ? `All ${allChecks.length} checks passed — agent correctly diagnosed stale errors and preserved the working fix (${conventionPass}/${conventionChecks.length} diagnostic discipline)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, diagnostic: ${conventionPass}/${conventionChecks.length})`;

console.log(JSON.stringify(results, null, 2));
