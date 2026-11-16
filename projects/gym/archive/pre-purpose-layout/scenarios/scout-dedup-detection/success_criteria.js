const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-dedup-detection', passed: false, checks: [], summary: '' };

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

const triagePath = path.join(envDir, 'triage-result.md');

check('triage-file-exists', () => {
  const exists = fs.existsSync(triagePath);
  return { passed: exists, detail: exists ? 'triage-result.md exists' : 'missing' };
});

check('finding-1-add', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const section = content.split(/finding\s*2/i)[0];
  const isAdd = /ADD/i.test(section) && /finding\s*1/i.test(section);
  return { passed: isAdd, detail: isAdd ? 'Finding 1 correctly ADD (Self-Refine is new)' : 'Finding 1 should be ADD — Self-Refine is not in existing papers' };
});

check('finding-2-skip', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const afterF1 = content.split(/finding\s*2/i)[1] || '';
  const section = afterF1.split(/finding\s*3/i)[0];
  const isSkip = /SKIP|DUP/i.test(section);
  return { passed: isSkip, detail: isSkip ? 'Finding 2 correctly SKIP (MemGPT duplicate of PP-202)' : 'Finding 2 should be SKIP — same arXiv ID as PP-202' };
});

check('finding-3-add', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const afterF2 = content.split(/finding\s*3/i)[1] || '';
  const section = afterF2.split(/finding\s*4/i)[0];
  const isAdd = /ADD/i.test(section);
  return { passed: isAdd, detail: isAdd ? 'Finding 3 correctly ADD (AgentVerse is new)' : 'Finding 3 should be ADD — AgentVerse not in discoveries' };
});

check('finding-4-skip', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const afterF3 = content.split(/finding\s*4/i)[1] || '';
  const section = afterF3.split(/finding\s*5/i)[0];
  const isSkip = /SKIP|DUP/i.test(section);
  return { passed: isSkip, detail: isSkip ? 'Finding 4 correctly SKIP (crewAI duplicate of D-301)' : 'Finding 4 should be SKIP — same URL as D-301' };
});

check('finding-5-skip', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const afterF4 = content.split(/finding\s*5/i)[1] || '';
  const isSkip = /SKIP|DUP/i.test(afterF4);
  return { passed: isSkip, detail: isSkip ? 'Finding 5 correctly SKIP (same arXiv as PP-204)' : 'Finding 5 should be SKIP — same arXiv ID as PP-204, just different title' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout correctly identified 2 new items and 3 duplicates'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
