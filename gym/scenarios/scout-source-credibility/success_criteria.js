const fs = require('fs');
const path = require('path');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'scout-source-credibility', passed: false, checks: [], summary: '' };

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

const assessPath = path.join(envDir, 'credibility-assessment.md');

check('file-exists', () => {
  const exists = fs.existsSync(assessPath);
  return { passed: exists, detail: exists ? 'credibility-assessment.md exists' : 'missing' };
});

check('all-five-assessed', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const count = [/source\s*1/i, /source\s*2/i, /source\s*3/i, /source\s*4/i, /source\s*5/i].filter(r => r.test(content)).length;
  return { passed: count >= 5, detail: `${count}/5 sources assessed` };
});

// Source 1: REJECT — anonymous, extraordinary claims, proprietary benchmarks, no code
check('source1-reject', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const section = content.split(/source\s*2/i)[0];
  const rejected = /REJECT|QUESTIONABLE/i.test(section) && /SKIP/i.test(section);
  return { passed: rejected, detail: rejected ? 'Source 1 correctly flagged (anonymous + extraordinary claims)' : 'Source 1 should be REJECT/SKIP — anonymous authors, extraordinary unverified claims' };
});

// Source 2: STRONG — known authors, code available, proper benchmarks
check('source2-strong', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const afterS1 = content.split(/source\s*2/i)[1] || '';
  const section = afterS1.split(/source\s*3/i)[0];
  const strong = /STRONG/i.test(section) && /DEEP.?DIVE/i.test(section);
  return { passed: strong, detail: strong ? 'Source 2 correctly rated STRONG' : 'Source 2 should be STRONG/DEEP-DIVE — credible authors, code, proper methodology' };
});

// Source 3: REJECT — blog post, no benchmarks, self-promotion
check('source3-reject', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const afterS2 = content.split(/source\s*3/i)[1] || '';
  const section = afterS2.split(/source\s*4/i)[0];
  const rejected = /REJECT/i.test(section) && /SKIP/i.test(section);
  return { passed: rejected, detail: rejected ? 'Source 3 correctly REJECT' : 'Source 3 should be REJECT/SKIP — blog post, no evidence, self-promotion' };
});

// Source 4: STRONG — peer-reviewed, reputable institutions, formal proofs
check('source4-strong', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const afterS3 = content.split(/source\s*4/i)[1] || '';
  const section = afterS3.split(/source\s*5/i)[0];
  const strong = /STRONG/i.test(section);
  return { passed: strong, detail: strong ? 'Source 4 correctly rated STRONG' : 'Source 4 should be STRONG — peer-reviewed, formal proofs, reputable team' };
});

// Source 5: QUESTIONABLE — known author but disputed claims, no real hardware, domain mismatch
check('source5-questionable', () => {
  if (!fs.existsSync(assessPath)) return { passed: false, detail: 'no file' };
  const content = fs.readFileSync(assessPath, 'utf-8');
  const afterS4 = content.split(/source\s*5/i)[1] || '';
  const notStrong = !/STRONG/i.test(afterS4);
  const flagged = /QUESTIONABLE|SKIM|disputed|theoretical|not.*practical/i.test(afterS4);
  return { passed: notStrong && flagged, detail: notStrong && flagged ? 'Source 5 correctly flagged as questionable' : 'Source 5 should be QUESTIONABLE — disputed claims, theoretical only, domain mismatch' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Scout correctly assessed source credibility across all 5 items'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
