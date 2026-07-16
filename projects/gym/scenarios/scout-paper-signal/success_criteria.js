const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-paper-signal', passed: false, checks: [], summary: '' };

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

const verdictPath = path.join(envDir, 'verdicts.md');

check('verdicts-file-exists', () => {
  const exists = fs.existsSync(verdictPath);
  return { passed: exists, detail: exists ? 'verdicts.md exists' : 'verdicts.md not found' };
});

check('all-six-papers-rated', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8').toUpperCase();
  const papers = ['PAPER A', 'PAPER B', 'PAPER C', 'PAPER D', 'PAPER E', 'PAPER F'];
  const found = papers.filter(p => content.includes(p) || content.includes(p.replace('PAPER ', '')));
  return { passed: found.length >= 6, detail: `${found.length}/6 papers rated` };
});

// Paper A (collaborative memory) = HIGH — directly about agent collaboration + memory
check('paper-a-high', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const sectionA = content.split(/paper\s*[bB]/i)[0]; // everything before Paper B
  const isHigh = /paper\s*a/i.test(sectionA) && /HIGH/i.test(sectionA);
  return { passed: isHigh, detail: isHigh ? 'Paper A correctly rated HIGH' : 'Paper A should be HIGH (agent collaboration + shared memory)' };
});

// Paper B (scaling laws for FFN) = LOW — pure ML theory, no agent relevance
check('paper-b-low', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const afterA = content.split(/paper\s*[bB]/i)[1] || '';
  const sectionB = afterA.split(/paper\s*[cC]/i)[0];
  const isLow = /LOW/i.test(sectionB);
  return { passed: isLow, detail: isLow ? 'Paper B correctly rated LOW' : 'Paper B should be LOW (FFN scaling laws, no agent relevance)' };
});

// Paper C (adversarial robustness for agents) = HIGH — directly about adversarial verification
check('paper-c-high', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const afterB = content.split(/paper\s*[cC]/i)[1] || '';
  const sectionC = afterB.split(/paper\s*[dD]/i)[0];
  const isHigh = /HIGH/i.test(sectionC);
  return { passed: isHigh, detail: isHigh ? 'Paper C correctly rated HIGH' : 'Paper C should be HIGH (adversarial testing for agents)' };
});

// Paper E (context drift) = HIGH — directly about context learning
check('paper-e-high', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const afterD = content.split(/paper\s*[eE]/i)[1] || '';
  const sectionE = afterD.split(/paper\s*[fF]/i)[0];
  const isHigh = /HIGH/i.test(sectionE);
  return { passed: isHigh, detail: isHigh ? 'Paper E correctly rated HIGH' : 'Paper E should be HIGH (context drift detection)' };
});

// Paper D (RAG survey) and F (GPT-5 benchmarks) should NOT be HIGH
check('paper-d-not-high', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const afterC = content.split(/paper\s*[dD]/i)[1] || '';
  const sectionD = afterC.split(/paper\s*[eE]/i)[0];
  const isHigh = /HIGH/i.test(sectionD);
  return { passed: !isHigh, detail: !isHigh ? 'Paper D correctly not HIGH' : 'Paper D should be MEDIUM or LOW (broad survey, tangential)' };
});

check('paper-f-not-high', () => {
  if (!fs.existsSync(verdictPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(verdictPath, 'utf-8');
  const afterE = content.split(/paper\s*[fF]/i)[1] || '';
  const isHigh = /HIGH/i.test(afterE);
  return { passed: !isHigh, detail: !isHigh ? 'Paper F correctly not HIGH' : 'Paper F should be LOW (benchmark paper, no specific agent insight)' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout correctly distinguished high-signal agent papers from noise'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
