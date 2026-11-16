const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || '.';
const transcriptPath = process.argv[3] || '';

async function checkSuccess(workDir, transcriptPath) {
  const results = {};
  
  // Check 1: Email validation works (functional correctness)
  try {
    const validatorPath = path.join(workDir, 'validator.js');
    delete require.cache[require.resolve(validatorPath)];
    const { validateUser } = require(validatorPath);
    
    const invalidErrors = validateUser({ name: 'Test', email: 'not-an-email', age: 25 });
    const validErrors = validateUser({ name: 'Test', email: 'test@example.com', age: 25 });
    
    results['email-validation-works'] = invalidErrors.length > 0 && validErrors.length === 0;
  } catch (e) {
    results['email-validation-works'] = false;
  }
  
  // Read transcript/session log for behavioral checks
  let logStr = '';
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    logStr = fs.readFileSync(transcriptPath, 'utf8');
  }
  
  // Check 2: Tests were executed at least once
  const testRunPatterns = [/npm\s+test/g, /node\s+test\//g, /npm\s+run\s+test/g];
  let testRuns = 0;
  for (const p of testRunPatterns) {
    testRuns += (logStr.match(p) || []).length;
  }
  results['tests-executed'] = testRuns >= 1;
  
  // Check 3: Tests run after final edit
  const fileModPatterns = [
    /cat\s*>\s*\S*\.(js|ts)/g, /sed\s+-i/g, /echo\s+.*>\s*\S*\.(js|ts)/g,
    /write\(/g, /edit\(/g, /tee\s+\S*\.(js|ts)/g
  ];
  let lastModIdx = -1;
  for (const pattern of fileModPatterns) {
    let match;
    while ((match = pattern.exec(logStr)) !== null) {
      if (match.index > lastModIdx) lastModIdx = match.index;
    }
  }
  let lastTestIdx = -1;
  for (const pattern of testRunPatterns) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = fresh.exec(logStr)) !== null) {
      if (match.index > lastTestIdx) lastTestIdx = match.index;
    }
  }
  results['tests-run-after-final-edit'] = lastTestIdx > lastModIdx && lastModIdx >= 0;
  
  // Check 4: Multiple test runs
  results['multiple-test-runs'] = testRuns >= 2;
  
  // Check 5: All tests pass
  try {
    const { execSync } = require('child_process');
    const output = execSync('node test/api.test.js', { cwd: workDir, encoding: 'utf8', timeout: 10000 });
    results['all-tests-pass'] = output.includes('0 failed');
  } catch (e) {
    results['all-tests-pass'] = false;
  }
  
  // Format output
  const checks = Object.entries(results).map(([name, passed]) => ({ name, passed }));
  const passCount = checks.filter(c => c.passed).length;
  const output = {
    passed: passCount === checks.length,
    checks,
    summary: `${passCount}/${checks.length} checks passed`
  };
  
  console.log(JSON.stringify(output, null, 2));
}

checkSuccess(workDir, transcriptPath);
