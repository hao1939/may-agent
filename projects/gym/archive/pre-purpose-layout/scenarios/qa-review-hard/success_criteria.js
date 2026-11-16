/**
 * Success Criteria for "QA Review Hard"
 *
 * Tests whether the QA agent can find subtle bugs that all tests pass on.
 * The scenario has 4 planted bugs of increasing subtlety:
 * - Bug 1: validateSession doesn't delete expired tokens (spec violation)
 * - Bug 2: hasPermission bypasses session validation via cache (SECURITY)
 * - Bug 3: cleanupExpired doesn't clear permissionCache (incomplete cleanup)
 * - Bug 4: getActiveSessions returns mutable references (defense-in-depth)
 *
 * Grading:
 * - check 1: review file exists
 * - check 2: ran tests (evidence discipline)
 * - check 3: correct verdict (should be FAIL or PASS_WITH_NOTES — there ARE bugs)
 * - check 4: finds the expired-token-not-deleted spec violation
 * - check 5: finds the hasPermission cache bypass security bug
 * - check 6: finds the incomplete cleanup (permissionCache not cleared)
 * - check 7: no hallucinated findings (false positive penalty)
 */

const pathMod = require('path');
const fs = require('fs');

const workDir = process.argv[2] || pathMod.join(__dirname, 'environment');

const results = {
  scenario: 'qa-review-hard',
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
  const envDir = pathMod.join(workDir, 'environment');
  const dirs = [workDir, envDir];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const candidates = [
      pathMod.join(dir, 'review-verdict.md'),
      pathMod.join(dir, 'review.md'),
      pathMod.join(dir, 'verdict.md'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return fs.readFileSync(c, 'utf-8');
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'SPEC.md' && f !== 'task.md');
    for (const f of files) {
      const content = fs.readFileSync(pathMod.join(dir, f), 'utf-8');
      if (content.toLowerCase().includes('verdict') || content.toLowerCase().includes('review')) {
        return content;
      }
    }
  }
  return null;
}

const reviewContent = findReviewFile();

// Check 1: review-verdict.md exists
check('review-file-exists', () => {
  if (!reviewContent) {
    return { passed: false, detail: 'No review verdict file found' };
  }
  return { passed: true, detail: 'Review file found' };
});

if (reviewContent) {
  const lower = reviewContent.toLowerCase();

  // Check 2: Evidence discipline — ran the tests
  check('ran-test-suite', () => {
    const ranTests = lower.includes('13/13') || lower.includes('all tests passed') || 
                     lower.includes('tests pass') || lower.includes('13 tests');
    if (!ranTests) {
      return { passed: false, detail: 'EVIDENCE_GAP: No evidence of running test suite' };
    }
    return { passed: true, detail: 'QA ran the test suite and reported results' };
  });

  // Check 3: Correct verdict — should NOT be a clean PASS (there are subtle bugs)
  check('correct-verdict', () => {
    const hasFail = /\bfail\b/.test(lower);
    const hasNotes = /pass.with.notes|pass_with_notes/.test(lower);
    const correctVerdict = hasFail || hasNotes;
    if (!correctVerdict) {
      return { passed: false, detail: 'Verdict appears to be clean PASS — missed the bugs' };
    }
    return { passed: true, detail: 'Verdict indicates issues found — correct' };
  });

  // Check 4: Finds expired token not deleted (spec violation)
  check('finds-expired-not-deleted', () => {
    const found =
      (lower.includes('expired') && (lower.includes('not deleted') || lower.includes('not removed') || lower.includes("doesn't delete") || lower.includes('does not delete') || lower.includes('memory leak') || lower.includes('still in') || lower.includes('remains in') || lower.includes('not clean'))) ||
      (lower.includes('validatesession') && (lower.includes('cleanup') || lower.includes('delete') || lower.includes('remove'))) ||
      (lower.includes('expired') && lower.includes('store') && (lower.includes('spec') || lower.includes('must') || lower.includes('should')));
    if (!found) {
      return { passed: false, detail: 'Missed: validateSession doesn\'t delete expired tokens per spec' };
    }
    return { passed: true, detail: 'Found spec violation: expired tokens not deleted from store' };
  });

  // Check 5: Finds hasPermission cache bypass (SECURITY — most critical)
  check('finds-cache-bypass-security', () => {
    const found =
      (lower.includes('cache') && (lower.includes('expired') || lower.includes('bypass') || lower.includes('security') || lower.includes('validation') || lower.includes('stale'))) ||
      (lower.includes('haspermission') && (lower.includes('expired') || lower.includes("doesn't validate") || lower.includes('does not validate') || lower.includes('skip') || lower.includes('bypass') || lower.includes('without valid')));
    if (!found) {
      return { passed: false, detail: 'Missed SECURITY BUG: expired sessions pass hasPermission via cache' };
    }
    return { passed: true, detail: 'Found SECURITY BUG: hasPermission cache bypasses session validation' };
  });

  // Check 6: Finds incomplete cleanup (permissionCache not cleared)
  check('finds-incomplete-cleanup', () => {
    const found =
      (lower.includes('cleanup') && lower.includes('cache')) ||
      (lower.includes('cleanupexpired') && lower.includes('permission')) ||
      (lower.includes('permission') && lower.includes('cache') && (lower.includes('not cleared') || lower.includes('not removed') || lower.includes('orphan') || lower.includes('leak') || lower.includes('stale') || lower.includes('not clean')));
    if (!found) {
      return { passed: false, detail: 'Missed: permissionCache entries survive cleanupExpired' };
    }
    return { passed: true, detail: 'Found: cleanupExpired doesn\'t clear permissionCache' };
  });

  // Check 7: No hallucinated findings
  check('no-hallucinated-findings', () => {
    const hallucinations = [];
    if (lower.includes('math.random') && !lower.includes('does not use math.random')) {
      hallucinations.push('Claims Math.random is used (it uses crypto.randomBytes)');
    }
    if (lower.includes('sql injection') || lower.includes('xss')) {
      hallucinations.push('Claims SQL injection or XSS (no database or HTML)');
    }
    if (hallucinations.length > 0) {
      return { passed: false, detail: `Hallucinated findings: ${hallucinations.join('; ')}` };
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
  results.summary = `QA found all subtle bugs including security cache bypass (${passCount}/${totalCount})`;
} else {
  const failures = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `QA missed subtle bugs: ${failures.join(', ')} (${passCount}/${totalCount})`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
