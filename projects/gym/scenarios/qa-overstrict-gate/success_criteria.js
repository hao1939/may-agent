/**
 * Success Criteria for "QA Overstrict Gate"
 *
 * Tests whether the QA agent correctly distinguishes between:
 * - Environment-level test failures (missing deps, unrelated tests)
 * - Patch-level correctness (the actual fix being reviewed)
 *
 * A GOOD QA agent should:
 * 1. Create a review verdict file
 * 2. Give PASS (or CONDITIONAL) — the patch is correct
 * 3. Note that vitest/tsc failures are from environment issues, not the patch
 * 4. Specifically identify the missing @external/* deps as the cause
 * 5. Confirm the actual code fix (>= to >) is correct
 * 6. NOT mark FAIL solely because vitest --run returned non-zero
 *
 * A BAD QA agent (OVER-STRICT_GATE) would:
 * - Mark FAIL because vitest --run failed
 * - Not distinguish between environment failures and patch failures
 * - Treat repo-wide test failure as evidence the patch is broken
 *
 * Usage: node success_criteria.js <path-to-work-dir>
 */

const path = require('path');
const fs = require('fs');

const workDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'qa-overstrict-gate',
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

// Find the review verdict file
function findReviewFile() {
  const candidates = [
    path.join(workDir, 'review-verdict.md'),
    path.join(workDir, 'review.md'),
    path.join(workDir, 'verdict.md'),
  ];
  
  // Also check agent workspace directories (gym writes there)
  const gymRoot = path.dirname(workDir);
  const agentWorkspaceCandidates = [
    path.join(gymRoot, 'agents-lab', 'qa', 'workspace', 'review-verdict.md'),
    path.join(gymRoot, 'agents-lab', 'qa', 'workspace', 'review.md'),
    path.join(gymRoot, 'agents-lab', 'qa', 'workspace', 'verdict.md'),
    path.join(gymRoot, 'agents-lab', 'qa', 'workspace', 'DIAGNOSIS.md'),
  ];
  
  const allCandidates = [...candidates, ...agentWorkspaceCandidates];
  
  for (const c of allCandidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf-8');
  }
  
  // Check any .md file with verdict/review content in work dir
  const files = fs.readdirSync(workDir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(workDir, f), 'utf-8');
    if (content.toLowerCase().includes('verdict') || content.toLowerCase().includes('review')) {
      return content;
    }
  }
  
  // Check agent workspace for any review-like file
  const qaWorkspace = path.join(gymRoot, 'agents-lab', 'qa', 'workspace');
  if (fs.existsSync(qaWorkspace)) {
    const wsFiles = fs.readdirSync(qaWorkspace).filter(f => f.endsWith('.md'));
    for (const f of wsFiles) {
      const content = fs.readFileSync(path.join(qaWorkspace, f), 'utf-8');
      if (content.toLowerCase().includes('verdict') || content.toLowerCase().includes('review') ||
          content.toLowerCase().includes('diagnosis') || content.toLowerCase().includes('assessment')) {
        return content;
      }
    }
  }
  
  return null;
}

const reviewContent = findReviewFile();

// Check 1: Review file was created
check('review-file-exists', () => {
  if (!reviewContent) {
    return { passed: false, detail: 'No review verdict file found in work directory' };
  }
  return { passed: true, detail: 'Review verdict file found' };
});

if (reviewContent) {
  const lower = reviewContent.toLowerCase();

  // Check 2: Overall verdict is NOT FAIL
  check('verdict-not-fail', () => {
    const verdictMatch = lower.match(/(?:overall\s+)?verdict[:\s*—-]+(pass|fail|conditional|pass_with_notes)/i);
    if (verdictMatch) {
      const verdict = verdictMatch[1].toLowerCase();
      if (verdict === 'fail') {
        return { 
          passed: false, 
          detail: 'OVER-STRICT_GATE: QA gave FAIL verdict for a correct patch — likely gating on environment vitest failures' 
        };
      }
      return { passed: true, detail: `Verdict: ${verdict.toUpperCase()} — appropriate` };
    }
    // No explicit verdict match — check for FAIL language
    const lines = reviewContent.split('\n');
    for (const line of lines) {
      const l = line.toLowerCase();
      // Look for verdict-like lines
      if ((l.includes('verdict') || l.includes('##')) && l.includes('fail') && 
          !l.includes('failover') && !l.includes('failure gracefully') && !l.includes('fail-safe')) {
        return { 
          passed: false, 
          detail: 'Verdict line appears to contain FAIL — QA gating on environment issues' 
        };
      }
    }
    return { passed: true, detail: 'No FAIL verdict detected' };
  });

  // Check 3: Recognizes environment/dependency issue
  check('identifies-environment-issue', () => {
    const envAware = lower.includes('environment') || lower.includes('missing dep') || 
                     lower.includes('not installed') || lower.includes('@external') ||
                     lower.includes('unrelated') || lower.includes('pre-existing') ||
                     lower.includes('missing package') || lower.includes('missing module') ||
                     lower.includes('cannot find module') || lower.includes('dependency') ||
                     lower.includes('queue-lib') || lower.includes('not available');
    if (!envAware) {
      return { 
        passed: false, 
        detail: 'QA did not identify that test failures are from environment/dependency issues' 
      };
    }
    return { passed: true, detail: 'QA correctly identified environment/dependency issue' };
  });

  // Check 4: Distinguishes patch tests from unrelated tests
  check('distinguishes-patch-from-environment', () => {
    // QA should note that the PATCH-specific tests (task-router.test.ts) are fine
    // and that failures come from unrelated-integration.test.ts
    const mentionsPatchTests = lower.includes('task-router.test') || lower.includes('patch') ||
                                lower.includes('module test') || lower.includes('unit test');
    const mentionsUnrelated = lower.includes('unrelated') || lower.includes('integration test') ||
                               lower.includes('queue-lib') || lower.includes('distributed') ||
                               lower.includes('separate') || lower.includes('different test');
    
    if (mentionsPatchTests || mentionsUnrelated) {
      return { passed: true, detail: 'QA distinguishes between patch-specific and unrelated test failures' };
    }
    return { 
      passed: false, 
      detail: 'QA did not distinguish patch-specific tests from unrelated failing tests' 
    };
  });

  // Check 5: Confirms the fix is correct (> to >=)
  check('confirms-fix-correctness', () => {
    const mentionsFix = lower.includes('>=') || lower.includes('> instead') || 
                        lower.includes('comparison') || lower.includes('operator') ||
                        lower.includes('stable order') || lower.includes('fifo') ||
                        lower.includes('off-by-one') || lower.includes('priority') ||
                        lower.includes('correct') || lower.includes('fix is');
    if (!mentionsFix) {
      return { passed: false, detail: 'QA did not assess the actual code fix for correctness' };
    }
    return { passed: true, detail: 'QA assessed the fix correctness' };
  });

  // Check 6: Does NOT blame the patch for vitest failures
  check('no-false-blame', () => {
    // Check for language that blames the patch for test failures
    const blamePatterns = [
      /patch.*caus.*fail/i,
      /change.*broke.*test/i,
      /fix.*introduc.*fail/i,
      /regression.*caused.*by/i,
      /this change.*breaks/i,
    ];
    
    for (const pattern of blamePatterns) {
      if (pattern.test(reviewContent)) {
        return { 
          passed: false, 
          detail: `QA incorrectly blames the patch for test failures: ${pattern.source}` 
        };
      }
    }
    return { passed: true, detail: 'QA does not falsely blame the patch for environment test failures' };
  });
}

// Calculate results
const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

const passCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;

if (allPassed) {
  results.summary = `QA correctly distinguished environment failures from patch correctness and gave appropriate verdict (${passCount}/${totalCount} checks passed)`;
} else {
  const failures = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `QA showed OVER-STRICT_GATE behavior: ${failures.join(', ')} (${passCount}/${totalCount} checks passed)`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
