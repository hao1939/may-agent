const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-discovery-novelty', passed: false, checks: [], summary: '' };

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

const assessPath = path.join(envDir, 'novelty-assessment.md');

check('file-exists', () => {
  const exists = fs.existsSync(assessPath);
  return { passed: exists, detail: exists ? 'exists' : 'missing' };
});

check('all-five-assessed', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const count = [/paper\s*1/i, /paper\s*2/i, /paper\s*3/i, /paper\s*4/i, /paper\s*5/i].filter(r => r.test(c)).length;
  return { passed: count >= 5, detail: `${count}/5 papers assessed` };
});

// Paper 1: NOVEL — predictive pre-loading is genuinely new (known techniques are all reactive)
check('paper1-novel', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const section = c.split(/paper\s*2/i)[0];
  return { passed: /NOVEL/i.test(section), detail: /NOVEL/i.test(section) ? 'Paper 1 correctly NOVEL' : 'Paper 1 should be NOVEL — predictive context pre-loading has no prior art in known techniques' };
});

// Paper 2: REPACKAGING — role-based multi-agent is well-known (CrewAI, AutoGen)
check('paper2-repackaging', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const after1 = c.split(/paper\s*2/i)[1] || '';
  const section = after1.split(/paper\s*3/i)[0];
  return { passed: /REPACKAG|INCREMENTAL/i.test(section), detail: /REPACKAG/i.test(section) ? 'Paper 2 correctly REPACKAGING' : 'Paper 2 should be REPACKAGING — role-based agents are well-known (CrewAI, AutoGen)' };
});

// Paper 3: INCREMENTAL — fuzzing is known in software, but adaptation to agent tools + finding new vuln classes has value
check('paper3-incremental', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const after2 = c.split(/paper\s*3/i)[1] || '';
  const section = after2.split(/paper\s*4/i)[0];
  // Accept INCREMENTAL or NOVEL (borderline — applying fuzzing is known, but finding new vuln classes adds value)
  const notRepackaging = !/REPACKAG/i.test(section);
  return { passed: notRepackaging && /INCREMENTAL|NOVEL/i.test(section), detail: notRepackaging ? 'Paper 3 correctly not REPACKAGING' : 'Paper 3 should be INCREMENTAL — fuzzing adaptation with new findings, not mere repackaging' };
});

// Paper 4: NOVEL — active self-healing contradiction resolution is genuinely new
check('paper4-novel', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const after3 = c.split(/paper\s*4/i)[1] || '';
  const section = after3.split(/paper\s*5/i)[0];
  return { passed: /NOVEL/i.test(section), detail: /NOVEL/i.test(section) ? 'Paper 4 correctly NOVEL' : 'Paper 4 should be NOVEL — active self-healing memory with autonomous contradiction resolution is new' };
});

// Paper 5: INCREMENTAL — importance-weighted summarization is a minor extension of known sliding window
check('paper5-incremental', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  const after4 = c.split(/paper\s*5/i)[1] || '';
  return { passed: /INCREMENTAL/i.test(after4), detail: /INCREMENTAL/i.test(after4) ? 'Paper 5 correctly INCREMENTAL' : 'Paper 5 should be INCREMENTAL — minor extension of existing sliding window + summarization' };
});

check('reasoning-provided', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const c = fs.readFileSync(assessPath, 'utf-8');
  return { passed: c.length > 600, detail: c.length > 600 ? 'Sufficient reasoning' : 'Need more specific reasoning for each rating' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout correctly distinguished novel, incremental, and repackaged contributions'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
