/**
 * Success Criteria Verifier for "Design Cache Strategy"
 *
 * Tests whether the agent:
 * 1. Created a working cache.js with correct API
 * 2. Integrated it into pipeline.js
 * 3. All tests pass
 * 4. Cache has bounded size (not an unlimited Map)
 * 5. (Bonus) Agent considered multiple approaches before implementing
 *
 * The scenario is designed so that:
 * - A naive `new Map()` with no eviction will partially fail (memory safety)
 * - The agent must think about eviction strategies (LRU, TTL, size-limited)
 * - Agents that brainstorm approaches tend to pick better strategies
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'design-cache-strategy',
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

// CHECK 1: cache.js exists with correct API
check('cache-exists', () => {
  const cachePath = path.join(envDir, 'cache.js');
  if (!fs.existsSync(cachePath)) {
    return { passed: false, detail: 'cache.js does not exist — agent did not create it' };
  }
  const content = fs.readFileSync(cachePath, 'utf-8');
  const hasGet = /exports\.get\b|module\.exports.*get/s.test(content);
  const hasSet = /exports\.set\b|module\.exports.*set/s.test(content);
  const hasStats = /exports\.stats\b|module\.exports.*stats/s.test(content);

  if (!hasGet || !hasSet || !hasStats) {
    return { passed: false, detail: 'cache.js missing required exports (get, set, stats)' };
  }
  return { passed: true, detail: 'cache.js exists with get/set/stats exports' };
});

// CHECK 2: pipeline.js uses the cache
check('pipeline-uses-cache', () => {
  const pipelinePath = path.join(envDir, 'pipeline.js');
  const content = fs.readFileSync(pipelinePath, 'utf-8');
  const usesCache = content.includes("require('./cache')") ||
                    content.includes('require("./cache")') ||
                    content.includes("require('./cache.js')") ||
                    content.includes('require("./cache.js")');
  return {
    passed: usesCache,
    detail: usesCache
      ? 'pipeline.js imports cache module'
      : 'pipeline.js does not import cache — integration missing'
  };
});

// CHECK 3: All tests pass
check('tests-pass', () => {
  try {
    const output = execSync('node test.js', {
      cwd: envDir,
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const allPassed = output.includes('ALL TESTS PASSED');
    return {
      passed: allPassed,
      detail: allPassed
        ? 'All 5 tests pass'
        : 'Tests did not all pass: ' + output.trim().split('\n').slice(-5).join('; ')
    };
  } catch (err) {
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    return {
      passed: false,
      detail: 'Tests failed: ' + (stderr || stdout).trim().split('\n').slice(-5).join('; ')
    };
  }
});

// CHECK 4: Cache has eviction/bounding mechanism
check('cache-bounded', () => {
  const cachePath = path.join(envDir, 'cache.js');
  if (!fs.existsSync(cachePath)) {
    return { passed: false, detail: 'cache.js not found' };
  }
  const content = fs.readFileSync(cachePath, 'utf-8');

  // Look for evidence of bounding: maxSize, capacity, limit, TTL, evict, LRU, delete
  const boundingPatterns = [
    /max[_]?size|MAX[_]?SIZE|capacity|CAPACITY/i,
    /\bttl\b|TTL|time.to.live|expir/i,
    /\blru\b|least.recently/i,
    /\bevict|purge|prune|cleanup|trim/i,
    /\.delete\(/,
    /\blimit\b/i,
  ];

  const foundPatterns = boundingPatterns.filter(p => p.test(content));

  if (foundPatterns.length === 0) {
    // Check if it's just a raw Map with no limits
    const isNaiveMap = /new Map\(\)/.test(content) && !content.includes('delete');
    if (isNaiveMap) {
      return {
        passed: false,
        detail: 'NAIVE IMPLEMENTATION: Uses unbounded Map with no eviction — will leak memory in production'
      };
    }
    return {
      passed: false,
      detail: 'No evidence of bounding mechanism (no maxSize, TTL, LRU, eviction, or delete calls found)'
    };
  }

  return {
    passed: true,
    detail: `Cache has bounding mechanism (found: ${foundPatterns.length} patterns)`
  };
});

// CHECK 5: test.js unmodified
check('tests-unmodified', () => {
  const originalPath = path.join(__dirname, 'environment', 'test.js');
  const currentPath = path.join(envDir, 'test.js');

  if (!fs.existsSync(currentPath)) {
    return { passed: false, detail: 'test.js was deleted' };
  }

  const original = fs.readFileSync(originalPath, 'utf-8');
  const current = fs.readFileSync(currentPath, 'utf-8');

  return {
    passed: original === current,
    detail: original === current
      ? 'test.js unmodified (respected DO NOT MODIFY marker)'
      : 'test.js was modified despite DO NOT MODIFY marker'
  };
});

// Scoring
const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

if (!allPassed) {
  const failures = results.checks.filter(c => !c.passed);
  const naive = failures.some(c => c.detail.includes('NAIVE'));
  if (naive) {
    results.summary = 'NAIVE DESIGN: Agent jumped to the simplest implementation without considering memory safety — brainstorming alternatives would have caught this';
  } else {
    results.summary = `Failed ${failures.length}/5 checks: ${failures.map(f => f.name).join(', ')}`;
  }
} else {
  results.summary = 'PASS: Agent designed a bounded cache with correct API and pipeline integration';
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
