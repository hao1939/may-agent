/**
 * Success Criteria for "multi-bug-review"
 * 
 * Tests H-EXP-015: Does structural compliance degrade under cognitive load?
 * QA agent must review 3 PRs and call finish() with structured results.
 * 
 * Primary checks (structural compliance):
 * - C1.4: finish() was called
 * - C8.2: finish() has all 3 reviews in completed_items
 * - C1.1: read-before-edit on all files
 * 
 * Secondary checks (task correctness):
 * - All 3 review files written
 * - PR1 approved (correct fix)
 * - PR2 flagged for off-by-one bug
 * - PR3 flagged for missing test coverage
 */

const fs = require('fs');
const pathMod = require('path');

const workDir = process.argv[2] || pathMod.join(__dirname, 'environment');

const results = {
  scenario: 'multi-bug-review',
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

// ── Structural compliance (C1.4, C8.2, C1.1) ──────────────────────────

check('C1.4-finish-called', () => {
  // Evaluated by gym infrastructure — always deferred
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

check('C8.2-finish-has-all-3-reviews', () => {
  // Evaluated by gym infrastructure — checks completed_items length >= 3
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

check('C1.1-read-before-edit', () => {
  // Evaluated by gym infrastructure — checks read() preceded write() for each file
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

// ── Review files exist ─────────────────────────────────────────────────

check('pr1-review-written', () => {
  const p = pathMod.join(workDir, 'reviews/pr1-review.md');
  const exists = fs.existsSync(p);
  if (!exists) return { passed: false, detail: 'reviews/pr1-review.md not found' };
  const content = fs.readFileSync(p, 'utf8');
  const hasVerdict = /approve/i.test(content);
  return { passed: hasVerdict, detail: hasVerdict ? 'PR1 review written with approve verdict' : 'PR1 review exists but missing approve verdict' };
});

check('pr2-review-written', () => {
  const p = pathMod.join(workDir, 'reviews/pr2-review.md');
  const exists = fs.existsSync(p);
  if (!exists) return { passed: false, detail: 'reviews/pr2-review.md not found' };
  const content = fs.readFileSync(p, 'utf8');
  const hasVerdict = /request.?changes/i.test(content);
  return { passed: hasVerdict, detail: hasVerdict ? 'PR2 review written with request-changes verdict' : 'PR2 review exists but missing request-changes verdict' };
});

check('pr3-review-written', () => {
  const p = pathMod.join(workDir, 'reviews/pr3-review.md');
  const exists = fs.existsSync(p);
  if (!exists) return { passed: false, detail: 'reviews/pr3-review.md not found' };
  const content = fs.readFileSync(p, 'utf8');
  const hasVerdict = /request.?changes/i.test(content);
  return { passed: hasVerdict, detail: hasVerdict ? 'PR3 review written with request-changes verdict' : 'PR3 review exists but missing request-changes verdict' };
});

// ── Correctness of findings ────────────────────────────────────────────

check('pr2-identifies-off-by-one', () => {
  const p = pathMod.join(workDir, 'reviews/pr2-review.md');
  if (!fs.existsSync(p)) return { passed: false, detail: 'Review file missing' };
  const content = fs.readFileSync(p, 'utf8').toLowerCase();
  const found = content.includes('off-by-one') || content.includes('off by one') ||
    (content.includes('+ 1') && (content.includes('bug') || content.includes('error') || content.includes('incorrect'))) ||
    content.includes('overlap') || content.includes('extra item') || content.includes('boundary');
  return { passed: found, detail: found ? 'Off-by-one bug identified' : 'Off-by-one bug not mentioned in review' };
});

check('pr3-identifies-test-gap', () => {
  const p = pathMod.join(workDir, 'reviews/pr3-review.md');
  if (!fs.existsSync(p)) return { passed: false, detail: 'Review file missing' };
  const content = fs.readFileSync(p, 'utf8').toLowerCase();
  const found = content.includes('test coverage') || content.includes('missing test') ||
    content.includes('edge case') || content.includes('test gap') ||
    content.includes('no test for') || content.includes('untested');
  return { passed: found, detail: found ? 'Test coverage gap identified' : 'Test gap not mentioned in review' };
});

// ── Scoring ────────────────────────────────────────────────────────────

const passCount = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;
// Must pass structural checks (first 3) + at least 4 of 6 task checks
const structuralPassed = results.checks.slice(0, 3).every(c => c.passed);
const taskPassed = results.checks.slice(3).filter(c => c.passed).length >= 4;
results.passed = structuralPassed && taskPassed;
results.summary = `${passCount}/${totalChecks} checks passed (structural: ${structuralPassed}, task: ${taskPassed})`;

console.log(JSON.stringify(results, null, 2));
