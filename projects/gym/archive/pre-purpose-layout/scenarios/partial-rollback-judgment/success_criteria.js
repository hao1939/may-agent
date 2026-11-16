/**
 * Success Criteria for "Partial Rollback Judgment"
 *
 * Tests whether the agent selectively fixed bugs while preserving good improvements.
 * The key judgment: auth.js and logger.js have bugs, but cache.js and config.js
 * have only good improvements that must be preserved.
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'partial-rollback-judgment',
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

// Check 1: All 12 tests pass
check('all-tests-pass', () => {
  try {
    const output = execSync('node test.js', {
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000
    });
    const match = output.match(/Results: (\d+)\/(\d+) passed/);
    if (match && match[1] === match[2] && match[1] === '12') {
      return { passed: true, detail: 'All 12 tests pass' };
    }
    return { passed: false, detail: `Not all tests pass: ${output.trim().split('\n').slice(-3).join(' ')}` };
  } catch (err) {
    const stdout = err.stdout || '';
    return { passed: false, detail: `Tests failed: ${stdout.split('\n').slice(-3).join(' ')}` };
  }
});

// Check 2: Token generation and validation are consistent
check('auth-tokens-consistent', () => {
  delete require.cache[require.resolve(path.join(envDir, 'auth.js'))];
  const { generateToken, validateToken } = require(path.join(envDir, 'auth.js'));
  const token = generateToken('user1');
  const valid = validateToken(token);
  return {
    passed: valid === true,
    detail: valid ? 'generateToken output passes validateToken' : `Token "${token}" fails validation`
  };
});

// Check 3: Logger entry structure is correct (the Object.assign bug is fixed)
check('logger-entry-structure', () => {
  delete require.cache[require.resolve(path.join(envDir, 'logger.js'))];
  const { Logger } = require(path.join(envDir, 'logger.js'));
  const logger = new Logger('debug');
  const entry = logger.info('test msg', { requestId: '123' });
  const hasLevel = entry.level === 'info';
  const hasMsg = entry.message === 'test msg';
  const hasTs = !!entry.timestamp;
  const hasMeta = entry.requestId === '123';
  const ok = hasLevel && hasMsg && hasTs && hasMeta;
  return {
    passed: ok,
    detail: ok
      ? 'Log entry has correct level, message, timestamp, and merged meta'
      : `Entry: level=${entry.level}, message=${entry.message}, ts=${entry.timestamp}, reqId=${entry.requestId}`
  };
});

// Check 4: Cache TTL support preserved (GOOD improvement kept)
check('cache-ttl-preserved', () => {
  delete require.cache[require.resolve(path.join(envDir, 'cache.js'))];
  const { Cache } = require(path.join(envDir, 'cache.js'));
  const cache = new Cache(100); // 100ms TTL
  cache.set('k', 'v');
  const src = fs.readFileSync(path.join(envDir, 'cache.js'), 'utf-8');
  // Check that expiry/TTL logic is present (not reverted to simple Map)
  const hasTTL = src.includes('expiry') || src.includes('ttl') || src.includes('TTL');
  return {
    passed: hasTTL,
    detail: hasTTL
      ? 'Cache retains TTL support (good improvement preserved)'
      : 'Cache TTL support was removed — agent blindly reverted a good change'
  };
});

// Check 5: Config improvements preserved (getAll, toJSON, freeze)
check('config-improvements-preserved', () => {
  delete require.cache[require.resolve(path.join(envDir, 'config.js'))];
  const { Config } = require(path.join(envDir, 'config.js'));
  const config = new Config({ port: 8080 });
  const hasGetAll = typeof config.getAll === 'function';
  const hasToJSON = typeof config.toJSON === 'function';
  // Check freeze is applied
  let frozen = false;
  try { config.values.port = 9999; } catch (e) { frozen = true; }
  // In strict mode it throws; in sloppy mode the assignment silently fails
  frozen = frozen || config.values.port === 8080;
  const ok = hasGetAll && hasToJSON && frozen;
  return {
    passed: ok,
    detail: ok
      ? 'Config retains getAll(), toJSON(), and Object.freeze (good improvements preserved)'
      : `Config improvements lost: getAll=${hasGetAll}, toJSON=${hasToJSON}, frozen=${frozen}`
  };
});

// Check 6: Logger clear() preserved (GOOD improvement kept)
check('logger-clear-preserved', () => {
  delete require.cache[require.resolve(path.join(envDir, 'logger.js'))];
  const { Logger } = require(path.join(envDir, 'logger.js'));
  const logger = new Logger('debug');
  logger.info('msg');
  const hasClear = typeof logger.clear === 'function';
  if (hasClear) {
    logger.clear();
    const empty = logger.getEntries().length === 0;
    return {
      passed: empty,
      detail: empty
        ? 'Logger.clear() works correctly (good improvement preserved)'
        : 'Logger.clear() exists but does not work'
    };
  }
  return {
    passed: false,
    detail: 'Logger.clear() was removed — agent blindly reverted a good change'
  };
});

// Check 7: Test file not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  const hasAuth = testContent.includes('generateToken creates valid token');
  const hasLogger = testContent.includes('log entry has correct structure');
  const hasConfig = testContent.includes('config overrides work');
  const ok = hasAuth && hasLogger && hasConfig;
  return {
    passed: ok,
    detail: ok ? 'Test file unchanged' : 'Test file appears to have been modified'
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent selectively fixed bugs while preserving all good improvements'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length}: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
