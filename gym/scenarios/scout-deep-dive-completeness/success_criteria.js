const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-deep-dive-completeness', passed: false, checks: [], summary: '' };

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

const ddPath = path.join(envDir, 'deep-dives', 'dd-769.md');
const papersPath = path.join(envDir, 'papers.md');

check('deep-dive-exists', () => {
  const exists = fs.existsSync(ddPath);
  return { passed: exists, detail: exists ? 'dd-769.md exists' : 'missing' };
});

check('phase1-summary', () => {
  if (!fs.existsSync(ddPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(ddPath, 'utf-8');
  const hasSummary = /phase\s*1|summary/i.test(content) && /TAD|temporal\s+attention\s+decay/i.test(content);
  const hasNumbers = /52%|18%|23%/.test(content);
  return { passed: hasSummary && hasNumbers, detail: hasSummary && hasNumbers ? 'Phase 1 present with key results' : 'Phase 1 must summarize TAD with key numbers' };
});

check('phase2-analysis', () => {
  if (!fs.existsSync(ddPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(ddPath, 'utf-8');
  const hasAnalysis = /phase\s*2|analysis|strength|weakness|limitation|novel/i.test(content);
  return { passed: hasAnalysis, detail: hasAnalysis ? 'Phase 2 analysis present' : 'Phase 2 analysis missing' };
});

check('phase3-relevance', () => {
  if (!fs.existsSync(ddPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(ddPath, 'utf-8');
  const hasRelevance = /phase\s*3|relevance|our\s+system|cross.?ref/i.test(content);
  const crossRefs = /PP-767|PP-766|MemGPT|context\s+window\s+management/i.test(content);
  return { passed: hasRelevance && crossRefs, detail: hasRelevance && crossRefs ? 'Phase 3 with cross-references' : 'Phase 3 must cross-reference existing papers (PP-766, PP-767)' };
});

check('phase4-propagation', () => {
  if (!fs.existsSync(ddPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(ddPath, 'utf-8');
  const hasPropagation = /phase\s*4|propagat/i.test(content);
  const mentionsUpdates = /papers\.md|hypothesis|H-\d+|flag/i.test(content);
  return { passed: hasPropagation && mentionsUpdates, detail: hasPropagation && mentionsUpdates ? 'Phase 4 propagation present' : 'Phase 4 must document propagation actions taken' };
});

check('papers-md-updated', () => {
  const content = fs.readFileSync(papersPath, 'utf-8');
  const hasTAD = /temporal\s+attention\s+decay|TAD|2604\.14001/i.test(content);
  const hasDD769 = /dd-769/i.test(content);
  return { passed: hasTAD && hasDD769, detail: hasTAD && hasDD769 ? 'papers.md updated with new entry' : 'papers.md must include new TAD paper entry referencing dd-769' };
});

check('hypothesis-created', () => {
  const hPath = path.join(envDir, 'hypotheses', 'H-050.md');
  const exists = fs.existsSync(hPath);
  if (!exists) return { passed: false, detail: 'H-050.md not created — paper suggests testable hypothesis about decay functions' };
  const content = fs.readFileSync(hPath, 'utf-8');
  const hasContent = content.length > 100;
  return { passed: hasContent, detail: hasContent ? 'Hypothesis file created with content' : 'Hypothesis file is too short' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout completed all 4 deep-dive phases including propagation'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
