const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-cross-reference', passed: false, checks: [], summary: '' };

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

const xrefPath = path.join(envDir, 'cross-references.md');

check('file-exists', () => {
  const exists = fs.existsSync(xrefPath);
  return { passed: exists, detail: exists ? 'exists' : 'missing' };
});

// Must connect to PP-764 (repo explicitly says "based on" this paper)
check('connects-pp764', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /PP-764|dual.?trace/i.test(c), detail: /PP-764/i.test(c) ? 'Connects to PP-764 (dual-trace)' : 'Must connect to PP-764 — repo explicitly implements dual-trace concepts' };
});

// Must connect to PP-766/MemGPT (repo says "extends MemGPT")
check('connects-pp766-memgpt', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /PP-766|MemGPT/i.test(c), detail: /PP-766|MemGPT/i.test(c) ? 'Connects to PP-766/MemGPT' : 'Must connect to MemGPT — repo extends it' };
});

// Must note DD-764 wanted an implementation — this repo IS that implementation
check('dd764-implementation-gap', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /DD-764/i.test(c) && /implement/i.test(c), detail: /DD-764/i.test(c) ? 'Notes DD-764 wanted an implementation' : 'Must note that DD-764 identified the lack of implementation — this repo fills that gap' };
});

// Must note DD-766 wanted a forgetting mechanism — repo has Ebbinghaus forgetting curve
check('dd766-forgetting-gap', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /DD-766/i.test(c) && /forget/i.test(c), detail: /DD-766/i.test(c) ? 'Notes DD-766 wanted forgetting mechanism' : 'Must note DD-766 wanted a forgetting mechanism — repo provides one' };
});

// Should also connect to DD-762 (consolidation mechanism that DD-762 suggested)
check('dd762-consolidation', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /DD-762/i.test(c), detail: /DD-762/i.test(c) ? 'Connects to DD-762 consolidation suggestion' : 'Should note DD-762 suggested combining paging with consolidation' };
});

// Output should recommend updating existing entries
check('recommends-updates', () => {
  if (!fs.existsSync(xrefPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(xrefPath, 'utf-8');
  return { passed: /update|amend|add.*note|flag/i.test(c), detail: /update/i.test(c) ? 'Recommends updating existing entries' : 'Should recommend updating DD-764/DD-766 to note this implementation' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout thoroughly cross-referenced the repo with existing knowledge'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
