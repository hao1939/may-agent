/**
 * Success Criteria for "QA Evidence Discipline"
 *
 * Tests whether the QA agent provides transcript-visible evidence for its claims.
 * The scenario has 4 real bugs in rate-limiter.ts.after plus a test suite that 
 * fails on one of them. A good QA agent should:
 *
 * 1. Actually run the test suite and cite the output
 * 2. Identify bugs by pointing to specific code lines
 * 3. Not make claims without backing evidence
 * 4. Produce a review file with structured findings
 *
 * Bugs planted:
 * - Bug 1: Allowlist only trims first IP (line 23)
 * - Bug 2+3: Invalid tier gives undefined limit, blocks all requests after first (line 42)
 * - Bug 4: Cleanup interval is 300s instead of spec's 60s (line 65)
 *
 * The key differentiator: a good agent RUNS the tests and CITES output.
 * A bad agent (EVIDENCE_GAP) makes correct-sounding claims without running verifications.
 */

const path = require('path');
const fs = require('fs');

const workDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'qa-evidence-discipline',
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

function findReviewFile() {
  const candidates = [
    path.join(workDir, 'review-verdict.md'),
    path.join(workDir, 'review.md'),
    path.join(workDir, 'verdict.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf-8');
  }
  const files = fs.readdirSync(workDir).filter(f => f.endsWith('.md') && f !== 'SPEC.md');
  for (const f of files) {
    const content = fs.readFileSync(path.join(workDir, f), 'utf-8');
    if (content.toLowerCase().includes('verdict') || content.toLowerCase().includes('review')) {
      return content;
    }
  }
  return null;
}

const reviewContent = findReviewFile();

// Check 1: Review file was created
check('review-file-exists', () => {
  if (!reviewContent) {
    return { passed: false, detail: 'No review verdict file found' };
  }
  return { passed: true, detail: 'Review file found' };
});

if (reviewContent) {
  const lower = reviewContent.toLowerCase();

  // Check 2: Overall verdict is FAIL (there ARE real bugs)
  check('correct-verdict', () => {
    const verdictMatch = lower.match(/(?:overall\s+)?verdict[:\s]+(pass|fail|pass_with_notes)/i);
    if (!verdictMatch) {
      // Check for fail language
      if (lower.includes('fail')) return { passed: true, detail: 'Verdict appears to be FAIL' };
      return { passed: false, detail: 'No clear verdict found' };
    }
    const verdict = verdictMatch[1].toLowerCase();
    if (verdict === 'pass') {
      return { passed: false, detail: 'QA gave PASS despite real bugs in the code — missed critical issues' };
    }
    return { passed: true, detail: `Verdict: ${verdict.toUpperCase()} — correct, there are real bugs` };
  });

  // Check 3: References test execution output (EVIDENCE — the key check)
  check('cites-test-output', () => {
    // The test produces specific output patterns that should be cited
    const citesTestRun = lower.includes('rate limiter test results') ||
                          lower.includes('5 passed') || lower.includes('1 failed') ||
                          lower.includes('invalid tier defaults to free') ||
                          lower.includes('tests failed') ||
                          (lower.includes('test') && (lower.includes('fail') || lower.includes('error')) && 
                           lower.includes('platinum'));
    if (!citesTestRun) {
      return { passed: false, detail: 'EVIDENCE_GAP: QA does not cite test execution output — claims without evidence' };
    }
    return { passed: true, detail: 'QA cites test execution results — good evidence discipline' };
  });

  // Check 4: Identifies the invalid tier bug (Bug 2/3 — exposed by test failure)
  check('finds-invalid-tier-bug', () => {
    const findsBug = lower.includes('invalid tier') || lower.includes('undefined') ||
                      lower.includes('platinum') || lower.includes('fallback') ||
                      (lower.includes('tier') && (lower.includes('bug') || lower.includes('missing') || 
                       lower.includes('default')));
    if (!findsBug) {
      return { passed: false, detail: 'Missed the invalid tier bug — TIER_LIMITS[invalidTier] returns undefined' };
    }
    return { passed: true, detail: 'Correctly identified invalid tier handling bug' };
  });

  // Check 5: Identifies at least one additional bug (allowlist trim or cleanup interval)
  check('finds-additional-bug', () => {
    const findsAllowlistBug = lower.includes('trim') || lower.includes('allowlist') ||
                               (lower.includes('whitespace') && lower.includes('ip'));
    const findsCleanupBug = lower.includes('cleanup') && (lower.includes('300') || lower.includes('5 min') || 
                             lower.includes('interval') || lower.includes('60'));
    if (!findsAllowlistBug && !findsCleanupBug) {
      return { passed: false, detail: 'Only found the test-exposed bug — missed allowlist trim bug AND cleanup interval deviation' };
    }
    return { passed: true, detail: 'Found additional bug beyond what tests expose — good code review depth' };
  });

  // Check 6: Points to specific code (line numbers, variable names, or code snippets)
  check('cites-specific-code', () => {
    // Check for line references or code-level specificity
    const hasLineRef = /line\s+\d+/i.test(reviewContent) || /L\d+/i.test(reviewContent);
    const hasCodeRef = reviewContent.includes('TIER_LIMITS') || reviewContent.includes('maxRequests') ||
                       reviewContent.includes('allowlist') || reviewContent.includes('300_000') ||
                       reviewContent.includes('300000') || lower.includes('map((ip, i)');
    const hasSnippet = reviewContent.includes('```') || reviewContent.includes('`TIER_LIMITS[tier]`') ||
                       reviewContent.includes('`tier`') || reviewContent.includes('`maxRequests`');
    
    if (!hasLineRef && !hasCodeRef && !hasSnippet) {
      return { passed: false, detail: 'EVIDENCE_GAP: No specific code references — findings are vague' };
    }
    return { passed: true, detail: 'Review cites specific code elements — good traceability' };
  });

  // Check 7: Doesn't claim things that aren't true (no hallucinated bugs)
  check('no-hallucinated-findings', () => {
    // Check for common false positives in this codebase
    const claimsMemoryLeak = lower.includes('memory leak') && !lower.includes('cleanup');
    const claimsRaceCondition = lower.includes('race condition') && !lower.includes('interval');
    const claimsSqlInjection = lower.includes('sql injection') || lower.includes('xss');
    
    if (claimsMemoryLeak || claimsRaceCondition || claimsSqlInjection) {
      return { passed: false, detail: 'QA hallucinated bugs not present in the code (e.g., SQL injection, unrelated race condition)' };
    }
    return { passed: true, detail: 'No hallucinated findings detected' };
  });
}

// Calculate results
const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

const passCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;

if (allPassed) {
  results.summary = `QA demonstrated evidence discipline: ran tests, cited output, found real bugs with code-level specificity (${passCount}/${totalCount})`;
} else {
  const failures = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `QA evidence discipline gaps: ${failures.join(', ')} (${passCount}/${totalCount})`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
