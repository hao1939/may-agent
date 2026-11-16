const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-research-prioritization', passed: false, checks: [], summary: '' };

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

const prioPath = path.join(envDir, 'prioritization.md');

check('file-exists', () => {
  const exists = fs.existsSync(prioPath);
  return { passed: exists, detail: exists ? 'prioritization.md exists' : 'missing' };
});

check('exactly-three-picks', () => {
  if (!fs.existsSync(prioPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(prioPath, 'utf-8');
  // Should mention exactly 3 as top picks
  const topSection = content.split(/deprioritiz|not\s+select|other|remaining/i)[0] || content;
  const picks = ['P1','P2','P3','P4','P5','P6','P7','P8'].filter(p => {
    const regex = new RegExp(`(top|pick|select|#\\s*\\d|rank).*${p}|${p}.*(top|pick|select|chosen|deep.?dive)`, 'i');
    return regex.test(topSection);
  });
  return { passed: picks.length === 3, detail: `${picks.length} papers selected as top picks (expected 3): ${picks.join(', ')}` };
});

// P1 (conflict resolution) maps directly to Q1 — MUST be in top 3
check('p1-selected', () => {
  if (!fs.existsSync(prioPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(prioPath, 'utf-8');
  const topSection = content.split(/deprioritiz|not\s+select|other|remaining/i)[0] || content;
  const selected = /P1/i.test(topSection) && (/top|pick|select|rank|#\s*\d|deep.?dive|priority/i.test(topSection));
  return { passed: selected, detail: selected ? 'P1 selected (maps to Q1: conflicting context)' : 'P1 should be top pick — directly answers Q1 about conflict resolution' };
});

// P4 (memory survey) should NOT be top 3 — team just finished memory work
check('p4-not-selected', () => {
  if (!fs.existsSync(prioPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(prioPath, 'utf-8');
  const depriSection = content.split(/deprioritiz|not\s+select|other|remaining/i)[1] || '';
  const inDepri = /P4/i.test(depriSection);
  const notInTop = !/P4.*(top|#\s*[123]|first|second|third)/i.test(content.split(/deprioritiz/i)[0]);
  return { passed: inDepri || notInTop, detail: inDepri ? 'P4 correctly deprioritized (memory work completed)' : 'P4 should be deprioritized — team just finished memory consolidation work' };
});

// P7 (RAG+MoE) should NOT be top 3 — no further RAG work needed
check('p7-not-selected', () => {
  if (!fs.existsSync(prioPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(prioPath, 'utf-8');
  const topSection = content.split(/deprioritiz|not\s+select|other|remaining/i)[0] || content;
  const notPicked = !/P7.*(top|pick|select|chosen|deep.?dive)/i.test(topSection);
  return { passed: notPicked, detail: notPicked ? 'P7 correctly excluded (RAG survey completed)' : 'P7 should not be top pick — team completed RAG work' };
});

// Must provide reasoning for deprioritized papers
check('deprioritization-reasoning', () => {
  if (!fs.existsSync(prioPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(prioPath, 'utf-8');
  const hasReasoning = content.length > 800;
  return { passed: hasReasoning, detail: hasReasoning ? 'Sufficient reasoning provided' : 'Need more reasoning for deprioritization decisions' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout correctly prioritized papers aligned with team needs and avoided completed topics'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
