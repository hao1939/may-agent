const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-hypothesis-formation', passed: false, checks: [], summary: '' };

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

const hPath = path.join(envDir, 'hypotheses', 'H-055.md');

check('hypothesis-file-exists', () => {
  const exists = fs.existsSync(hPath);
  return { passed: exists, detail: exists ? 'H-055.md exists' : 'missing' };
});

check('falsifiable-claim', () => {
  if (!fs.existsSync(hPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(hPath, 'utf-8');
  // Should state something that can be tested and potentially disproven
  const hasClaim = /single|one|first|diminishing|second.*worse|once.*sufficient/i.test(content);
  const isAboutVerification = /verif|check|review|gate|correct/i.test(content);
  return { passed: hasClaim && isAboutVerification, detail: hasClaim && isAboutVerification ? 'Contains falsifiable claim about verification' : 'Hypothesis must make a clear testable claim about verification passes' };
});

check('cites-observations', () => {
  if (!fs.existsSync(hPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(hPath, 'utf-8');
  const citeCount = [
    /DD-750|observation\s*1|structured\s+output/i,
    /EXP-165|observation\s*2|verification\s+gate/i,
    /DD-762|observation\s*3|self-correct/i,
    /observation\s*4|QA\s+agent|review\s+pass/i
  ].filter(r => r.test(content)).length;
  return { passed: citeCount >= 3, detail: `Cites ${citeCount}/4 observations (need ≥3)` };
});

check('proposes-test', () => {
  if (!fs.existsSync(hPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(hPath, 'utf-8');
  const hasTest = /test|experiment|measure|compare|run|verify|A\/B|control|baseline/i.test(content);
  return { passed: hasTest, detail: hasTest ? 'Proposes concrete test' : 'Must propose how to test/verify the hypothesis' };
});

check('not-duplicate-of-h048', () => {
  if (!fs.existsSync(hPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(hPath, 'utf-8').toLowerCase();
  // H-048 is about "quality plateaus after 3 self-correction rounds"
  // The new hypothesis should be about single-pass being OPTIMAL (not just diminishing returns)
  // or about second passes being HARMFUL (not just less effective)
  const isDistinct = /harmful|counterproductive|negative|worse|degrad|introduc.*error|net.*negative|single.*optimal|one.*pass.*suffic/i.test(content);
  return { passed: isDistinct, detail: isDistinct ? 'Distinct from H-048 — focuses on harm of additional passes, not just diminishing returns' : 'Must be distinct from H-048 — the pattern is that second verification is actively HARMFUL, not just less effective' };
});

check('synthesis-across-observations', () => {
  if (!fs.existsSync(hPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(hPath, 'utf-8');
  const longEnough = content.length > 400;
  return { passed: longEnough, detail: longEnough ? 'Sufficient depth for synthesis' : 'Hypothesis too short — must synthesize pattern across multiple observations' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout formed a well-grounded, testable hypothesis distinct from existing ones'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
