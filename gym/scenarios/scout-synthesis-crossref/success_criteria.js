const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-synthesis-crossref', passed: false, checks: [], summary: '' };

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

const synthPath = path.join(envDir, 'synthesis.md');

check('synthesis-file-exists', () => {
  const exists = fs.existsSync(synthPath);
  return { passed: exists, detail: exists ? 'synthesis.md exists' : 'missing' };
});

check('has-summary', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const hasHVC = /HVC|hierarchical\s+verification/i.test(content);
  const hasTier = /tier/i.test(content);
  return { passed: hasHVC && hasTier, detail: hasHVC && hasTier ? 'Summary mentions HVC and tier structure' : 'Summary should describe HVC and its hierarchical tiers' };
});

// Must cross-ref H-041 (specialization hypothesis — directly confirmed by this paper)
check('crossref-h041-specialization', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const ref = /H-041|specializ/i.test(content);
  return { passed: ref, detail: ref ? 'Cross-references H-041 or specialization hypothesis' : 'Must reference H-041 — the paper directly confirms the specialization hypothesis' };
});

// Must cross-ref DD-450 (verification patterns — HVC is a new pattern)
check('crossref-dd450-verification', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const ref = /DD-450|verification\s+patterns/i.test(content);
  return { passed: ref, detail: ref ? 'Cross-references DD-450 or verification patterns survey' : 'Must reference DD-450 — HVC adds escalation mechanism that DD-450 noted was missing' };
});

// Must cross-ref PP-101 (adversarial testing — HVC addresses the weakness PP-101 found)
check('crossref-pp101-adversarial', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const ref = /PP-101|adversarial\s+test/i.test(content);
  return { passed: ref, detail: ref ? 'Cross-references PP-101 or adversarial testing' : 'Must reference PP-101 — HVC addresses the verification weakness PP-101 identified' };
});

// Should mention CrewAI compatibility (paper explicitly mentions it)
check('mentions-crewai-connection', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const ref = /CrewAI|D-200|AutoGen|PP-103/i.test(content);
  return { passed: ref, detail: ref ? 'Notes framework compatibility' : 'Should note HVC is compatible with CrewAI (D-200) and AutoGen (PP-103)' };
});

// Synthesis insight should go beyond listing — should identify an emergent understanding
check('synthesis-insight-present', () => {
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(synthPath, 'utf-8');
  const hasSynthesis = /synthesis|insight|emerges|combining|together|implication/i.test(content);
  const longEnough = content.length > 500;
  return { passed: hasSynthesis && longEnough, detail: hasSynthesis && longEnough ? 'Contains synthesis insight section' : 'Needs a synthesis insight that combines findings (>500 chars total)' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout produced thorough cross-references and meaningful synthesis'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
