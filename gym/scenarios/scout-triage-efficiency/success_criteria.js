const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-triage-efficiency', passed: false, checks: [], summary: '' };

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

const triagePath = path.join(envDir, 'triage-results.md');

check('file-exists', () => {
  const exists = fs.existsSync(triagePath);
  return { passed: exists, detail: exists ? 'exists' : 'missing' };
});

check('all-12-triaged', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(triagePath, 'utf-8');
  const count = Array.from({length: 12}, (_, i) => i + 1).filter(n => {
    const regex = new RegExp(`(^|\\n).*#?\\s*${n}[.:\\s]`, 'm');
    return regex.test(content);
  }).length;
  return { passed: count >= 12, detail: `${count}/12 papers triaged` };
});

// HIGH-signal papers that should be DEEP-DIVE: 1, 3, 5, 9, 11
check('paper1-deep-dive', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const section = c.split(/\n.*#?\s*2[.:\s]/m)[0] || c;
  return { passed: /DEEP/i.test(section), detail: /DEEP/i.test(section) ? 'Paper 1 DEEP-DIVE (multi-agent task allocation)' : 'Paper 1 should be DEEP-DIVE' };
});

check('paper3-deep-dive', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const after2 = c.split(/\n.*#?\s*3[.:\s]/m)[1] || '';
  const section = after2.split(/\n.*#?\s*4[.:\s]/m)[0] || after2;
  return { passed: /DEEP/i.test(section), detail: /DEEP/i.test(section) ? 'Paper 3 DEEP-DIVE (self-monitoring agents)' : 'Paper 3 should be DEEP-DIVE — capability boundary detection is core to our system' };
});

check('paper5-deep-dive', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const after4 = c.split(/\n.*#?\s*5[.:\s]/m)[1] || '';
  const section = after4.split(/\n.*#?\s*6[.:\s]/m)[0] || after4;
  return { passed: /DEEP/i.test(section), detail: /DEEP/i.test(section) ? 'Paper 5 DEEP-DIVE (adversarial prompt injection)' : 'Paper 5 should be DEEP-DIVE — adversarial verification is a focus area' };
});

check('paper9-deep-dive-or-skim', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const after8 = c.split(/\n.*#?\s*9[.:\s]/m)[1] || '';
  const section = after8.split(/\n.*#?\s*10[.:\s]/m)[0] || after8;
  return { passed: /DEEP|SKIM/i.test(section), detail: /DEEP|SKIM/i.test(section) ? 'Paper 9 at least SKIM (context contamination)' : 'Paper 9 should be at least SKIM — context learning is a focus area' };
});

check('paper11-deep-dive', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const after10 = c.split(/\n.*#?\s*11[.:\s]/m)[1] || '';
  const section = after10.split(/\n.*#?\s*12[.:\s]/m)[0] || after10;
  return { passed: /DEEP/i.test(section), detail: /DEEP/i.test(section) ? 'Paper 11 DEEP-DIVE (automated research pipeline)' : 'Paper 11 should be DEEP-DIVE — directly about automated research systems' };
});

// LOW-signal papers that should be SKIP: 2, 4, 8, 10, 12
check('irrelevant-papers-skipped', () => {
  if (!fs.existsSync(triagePath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(triagePath, 'utf-8');
  const sections = {
    '2': (c.split(/\n.*#?\s*2[.:\s]/m)[1] || '').split(/\n.*#?\s*3[.:\s]/m)[0],
    '4': (c.split(/\n.*#?\s*4[.:\s]/m)[1] || '').split(/\n.*#?\s*5[.:\s]/m)[0],
    '8': (c.split(/\n.*#?\s*8[.:\s]/m)[1] || '').split(/\n.*#?\s*9[.:\s]/m)[0],
    '10': (c.split(/\n.*#?\s*10[.:\s]/m)[1] || '').split(/\n.*#?\s*11[.:\s]/m)[0],
  };
  const skipped = Object.entries(sections).filter(([_, s]) => /SKIP/i.test(s)).length;
  return { passed: skipped >= 3, detail: `${skipped}/4 irrelevant papers correctly SKIP'd (need ≥3)` };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout efficiently triaged all 12 papers with correct signal detection'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
