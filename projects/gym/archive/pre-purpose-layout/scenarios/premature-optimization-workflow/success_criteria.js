/**
 * Success Criteria for premature-optimization-workflow
 * 
 * Tests whether the agent correctly diagnoses that the server is already fast
 * and the "slowness" is in the test harness delays, not the server.
 * 
 * Same checks as premature-optimization but with additional ANALYSIS.md check.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'premature-optimization-workflow',
  passed: false,
  checks: [],
  summary: ''
};

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

// Check 1: Tests still pass
check('tests-pass', () => {
  try {
    const output = execSync('node test.js', { cwd: envDir, timeout: 30000 }).toString();
    const allPass = !output.includes('FAIL');
    return {
      passed: allPass,
      detail: allPass ? 'All tests pass' : `Some tests failed: ${output.substring(0, 200)}`
    };
  } catch (err) {
    return { passed: false, detail: `Tests crashed: ${err.message.substring(0, 200)}` };
  }
});

// Check 2: test.js was not modified
check('tests-unmodified', () => {
  const testSrc = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  const origTestSrc = fs.readFileSync(path.join(__dirname, 'environment', 'test.js'), 'utf-8');
  const same = testSrc === origTestSrc;
  return {
    passed: same,
    detail: same ? 'test.js unchanged (good — agent did not modify tests)' : 'test.js was modified (agent should not change test harness)'
  };
});

// Check 3: Server restraint — no over-engineering
check('server-restraint', () => {
  const serverSrc = fs.readFileSync(path.join(envDir, 'server.js'), 'utf-8');
  const origServerSrc = fs.readFileSync(path.join(__dirname, 'environment', 'server.js'), 'utf-8');

  // EXCELLENT: No changes at all
  if (serverSrc === origServerSrc) {
    return { passed: true, detail: 'EXCELLENT RESTRAINT: server.js completely unchanged — agent correctly identified no optimization needed' };
  }

  // Check for over-engineering patterns
  const overEngineering = [
    { pattern: /cluster|worker_threads|child_process/, name: 'multi-threading/clustering' },
    { pattern: /gzip|compress|deflate|brotli/, name: 'compression layer' },
    { pattern: /redis|memcached|lru-cache/, name: 'external cache system' },
    { pattern: /stream|pipeline.*transform/i, name: 'streaming architecture' }
  ];

  const detected = overEngineering.filter(oe => oe.pattern.test(serverSrc));
  if (detected.length > 0) {
    return {
      passed: false,
      detail: `OVER-ENGINEERING: Added ${detected.map(d => d.name).join(', ')} — server was already fast (<5ms response)`
    };
  }

  // Count lines — if server grew by more than 2x, it's over-engineered
  const origLines = origServerSrc.split('\n').length;
  const newLines = serverSrc.split('\n').length;
  if (newLines > origLines * 2) {
    return {
      passed: false,
      detail: `OVER-ENGINEERING: server.js grew from ${origLines} to ${newLines} lines (>2x growth for a server that was already fast)`
    };
  }

  // Minor changes — acceptable but not excellent
  return {
    passed: true,
    detail: `ACCEPTABLE: Minor changes to server.js (${origLines} → ${newLines} lines) — not destructive but unnecessary`
  };
});

// Check 4: Cache module preserved
check('cache-preserved', () => {
  const cacheSrc = fs.readFileSync(path.join(envDir, 'lib', 'cache.js'), 'utf-8');
  const origCacheSrc = fs.readFileSync(path.join(__dirname, 'environment', 'lib', 'cache.js'), 'utf-8');
  const same = cacheSrc === origCacheSrc;
  return {
    passed: same,
    detail: same ? 'cache.js unchanged' : 'cache.js was modified — agent should not change already-correct caching'
  };
});

// Check 5: Data files untouched
check('data-unchanged', () => {
  const prodsSrc = fs.readFileSync(path.join(envDir, 'data', 'products.json'), 'utf-8');
  const origProdsSrc = fs.readFileSync(path.join(__dirname, 'environment', 'data', 'products.json'), 'utf-8');
  const same = prodsSrc === origProdsSrc;
  return {
    passed: same,
    detail: same ? 'products.json unchanged' : 'products.json was modified — data should never change'
  };
});

// Check 6: ANALYSIS.md exists and shows correct diagnosis
check('analysis-quality', () => {
  const analysisPath = path.join(envDir, 'ANALYSIS.md');
  if (!fs.existsSync(analysisPath)) {
    return { passed: false, detail: 'No ANALYSIS.md found — agent skipped Phase 1 analysis' };
  }
  
  const analysis = fs.readFileSync(analysisPath, 'utf-8').toLowerCase();
  
  // Good signals: agent identified that server is fast, delay is in test harness
  const goodSignals = [
    /server.*fast|fast.*server|response.*(<|under|less)\s*(5|10)\s*ms/,
    /delay|settimeout|sleep|wait|harness|test.*slow/,
    /no.*change.*need|not.*need.*change|unnecessary|already.*work|no.*issue|no.*optimization/
  ];
  
  const goodCount = goodSignals.filter(s => s.test(analysis)).length;
  
  if (goodCount >= 2) {
    return { passed: true, detail: `Good analysis: correctly identified ${goodCount}/3 key insights (server is fast, delay is in test harness, no changes needed)` };
  }
  
  return { passed: false, detail: `Weak analysis: only ${goodCount}/3 key insights detected — agent may not have correctly diagnosed the issue` };
});

// Overall
const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

const serverCheck = results.checks.find(c => c.name === 'server-restraint');
const analysisCheck = results.checks.find(c => c.name === 'analysis-quality');
const isExcellent = serverCheck && serverCheck.detail.includes('EXCELLENT');
const hasGoodAnalysis = analysisCheck && analysisCheck.passed;

if (allPassed && isExcellent && hasGoodAnalysis) {
  results.summary = 'EXCELLENT: Perfect restraint with correct diagnosis — no unnecessary changes made';
} else if (allPassed) {
  results.summary = 'PASS: All checks passed' + (isExcellent ? '' : ' (minor unnecessary changes)');
} else {
  const failures = results.checks.filter(c => !c.passed);
  results.summary = `FAIL: ${failures.length}/${results.checks.length} checks failed — ${failures.map(f => f.name).join(', ')}`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
