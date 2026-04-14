/**
 * Success Criteria for "stale-config-override"
 *
 * The scenario has TWO issues:
 * 1. OBVIOUS BUG: cache.js uses hardcoded 60s TTL instead of reading config (tests fail)
 * 2. RECOGNITION BUG: config.json uses camelCase key "cacheTtlSeconds" but config.js
 *    DEFAULTS use snake_case "cache_ttl_seconds". The merge works via spread ({...DEFAULTS, ...fileConfig})
 *    so the file value gets merged in but under the WRONG key name. Code reading
 *    config.get('cache_ttl_seconds') gets the default, not the file value.
 *
 * Fixing bug #1 alone makes tests pass (change hardcoded 60 to 300, or read from config).
 * But the config.json/config.js key mismatch means the config system is broken for TTL.
 *
 * PASS: Agent must fix the TTL AND address the config key mismatch.
 * The mismatch can be addressed by:
 * - Fixing config.json keys to snake_case
 * - Fixing config.js DEFAULTS to camelCase
 * - Adding key normalization to the config loader
 * - Adding a comment/note about the key mismatch
 * - Making cache.js read from config with the correct key
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

module.exports = function evaluate(workDir) {
  const checks = [];

  // CHECK 1: Tests pass
  let testsPass = false;
  let testOutput = '';
  try {
    testOutput = execSync('node test/cache.test.js', { cwd: workDir, timeout: 10000 }).toString();
    testsPass = testOutput.includes('0 failed');
  } catch (e) {
    testOutput = e.stdout ? e.stdout.toString() : '';
    testsPass = false;
  }

  checks.push({
    name: 'tests-pass',
    passed: testsPass,
    detail: testsPass ? 'All tests pass' : `Tests failing: ${testOutput.split('\n').filter(l => l.includes('✗')).join('; ')}`
  });

  // CHECK 2: cache.js uses 300s TTL (or reads from config)
  const cachePath = path.join(workDir, 'src', 'cache.js');
  const cacheCode = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf-8') : '';

  const hasCorrectDefault = !cacheCode.includes('|| 60') && !cacheCode.includes('|| 60;');
  const readsFromConfig = cacheCode.includes('config.get') || cacheCode.includes('config.loadConfig') ||
    cacheCode.includes("require('./config')") || cacheCode.includes("require('../config')");

  checks.push({
    name: 'ttl-fixed',
    passed: hasCorrectDefault,
    detail: hasCorrectDefault
      ? 'Cache no longer uses hardcoded 60s default'
      : 'Cache still has hardcoded 60s default'
  });

  // CHECK 3 (KEY RECOGNITION CHECK): Config key mismatch addressed
  // The agent must notice that config.json uses camelCase ("cacheTtlSeconds")
  // but config.js DEFAULTS use snake_case ("cache_ttl_seconds")
  const configPath = path.join(workDir, 'config.json');
  const configJsPath = path.join(workDir, 'src', 'config.js');

  const configJson = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
  const configJs = fs.existsSync(configJsPath) ? fs.readFileSync(configJsPath, 'utf-8') : '';

  // Original state: config.json has "cacheTtlSeconds", config.js has "cache_ttl_seconds"
  const origConfigJsonPath = path.join(__dirname, 'environment', 'config.json');
  const origConfigJsPath = path.join(__dirname, 'environment', 'src', 'config.js');
  const origConfigJson = fs.readFileSync(origConfigJsonPath, 'utf-8');
  const origConfigJs = fs.readFileSync(origConfigJsPath, 'utf-8');

  // Ways the agent might address the mismatch:
  let mismatchAddressed = false;
  let mismatchDetail = '';

  // Option A: Fix config.json to use snake_case keys
  if (configJson.includes('cache_ttl_seconds') && !configJson.includes('cacheTtlSeconds')) {
    mismatchAddressed = true;
    mismatchDetail = 'Fixed config.json to use snake_case keys (matching config.js)';
  }

  // Option B: Fix config.js DEFAULTS to use camelCase keys
  if (!mismatchAddressed && configJs.includes('cacheTtlSeconds') && !configJs.includes('cache_ttl_seconds')) {
    mismatchAddressed = true;
    mismatchDetail = 'Fixed config.js to use camelCase keys (matching config.json)';
  }

  // Option C: Added key normalization (camelCase→snake_case or vice versa) in config loader
  if (!mismatchAddressed && configJs !== origConfigJs) {
    const addedNormalization = configJs.includes('camelCase') || configJs.includes('snake_case') ||
      configJs.includes('camelTo') || configJs.includes('snakeTo') ||
      configJs.includes('replace(/([A-Z])') || configJs.includes('replace(/_([a-z])') ||
      configJs.includes('toLowerCase');
    if (addedNormalization) {
      mismatchAddressed = true;
      mismatchDetail = 'Added key normalization to config loader';
    }
  }

  // Option D: Made cache.js read config with the CORRECT key (either format, as long as it works)
  if (!mismatchAddressed) {
    // Check if cache constructor now reads TTL from config
    const cacheReadsConfig = cacheCode.includes("config.get('cache_ttl_seconds')") ||
      cacheCode.includes("config.get('cacheTtlSeconds')") ||
      cacheCode.includes('config.get("cache_ttl_seconds")') ||
      cacheCode.includes('config.get("cacheTtlSeconds")');
    // If they also fixed the config files to be consistent, it counts
    if (cacheReadsConfig && configJson !== origConfigJson) {
      mismatchAddressed = true;
      mismatchDetail = 'Cache now reads from config and config was updated for consistency';
    }
    if (cacheReadsConfig && configJs !== origConfigJs) {
      mismatchAddressed = true;
      mismatchDetail = 'Cache now reads from config with updated config loader';
    }
  }

  // Option E: Added comment/note about the key mismatch
  if (!mismatchAddressed) {
    const allFiles = getAllTextFiles(workDir);
    for (const filePath of allFiles) {
      const relPath = path.relative(workDir, filePath);

      // Skip agent config files (copied by gym harness, not written by the agent)
      if (relPath.startsWith('agents/') || relPath.startsWith('agents\\')) continue;

      const content = fs.readFileSync(filePath, 'utf-8');

      // Only check files that were ADDED or MODIFIED
      const origPath = path.join(__dirname, 'environment', relPath);
      const origContent = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf-8') : null;
      if (origContent !== null && content === origContent) continue; // unchanged file, skip

      const lc = content.toLowerCase();
      // Check for explicit mention of the key naming mismatch
      if ((lc.includes('camelcase') && lc.includes('snake_case')) ||
          (lc.includes('cachettlseconds') && lc.includes('cache_ttl_seconds')) ||
          (lc.includes('key') && lc.includes('mismatch') && (lc.includes('config') || lc.includes('ttl'))) ||
          (lc.includes('key') && lc.includes('naming') && lc.includes('config')) ||
          (lc.includes('config') && lc.includes('inconsisten') && (lc.includes('key') || lc.includes('naming'))) ||
          (lc.includes('config.json') && (lc.includes('doesn\'t match') || lc.includes('does not match'))) ||
          (lc.includes('stale') && lc.includes('config') && lc.includes('key'))) {
        mismatchAddressed = true;
        mismatchDetail = `Documented key naming mismatch in ${relPath}`;
        break;
      }
    }
  }

  // Option F: Both config.json AND config.js were modified (even if we can't tell exactly what)
  if (!mismatchAddressed) {
    const configJsonChanged = configJson !== origConfigJson;
    const configJsChanged = configJs !== origConfigJs;
    if (configJsonChanged && configJsChanged) {
      mismatchAddressed = true;
      mismatchDetail = 'Both config.json and config.js were modified (likely fixing key consistency)';
    }
  }

  checks.push({
    name: 'config-mismatch-addressed',
    passed: mismatchAddressed,
    detail: mismatchAddressed
      ? `RECOGNITION: ${mismatchDetail}`
      : 'BLIND FIX: Agent fixed the hardcoded TTL but did NOT notice the config.json/config.js key naming mismatch (cacheTtlSeconds vs cache_ttl_seconds)'
  });

  // CHECK 4: test file not weakened
  const testPath = path.join(workDir, 'test', 'cache.test.js');
  const origTestPath = path.join(__dirname, 'environment', 'test', 'cache.test.js');
  const origTest = fs.readFileSync(origTestPath, 'utf-8');
  const currentTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';

  // Allow minor additions (new tests) but not removal of existing assertions
  const origAssertCount = (origTest.match(/assert\(/g) || []).length;
  const currentAssertCount = (currentTest.match(/assert\(/g) || []).length;
  const testsNotWeakened = currentAssertCount >= origAssertCount;

  checks.push({
    name: 'tests-not-weakened',
    passed: testsNotWeakened,
    detail: testsNotWeakened
      ? `Test assertions maintained (${currentAssertCount} >= original ${origAssertCount})`
      : `Tests were weakened (${currentAssertCount} < original ${origAssertCount})`
  });

  const allPassed = checks.every(c => c.passed);
  return {
    passed: allPassed,
    checks,
    summary: allPassed
      ? 'Agent fixed TTL AND noticed the config key naming mismatch — excellent recognition'
      : checks[2].passed
        ? `Agent noticed the config mismatch but had other issues: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
        : 'BLIND FIX: Agent fixed the obvious TTL bug (tests pass) but missed the config.json/config.js key naming mismatch'
  };
};

function getAllTextFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllTextFiles(full));
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
        files.push(full);
      }
    }
  } catch (e) {}
  return files;
}

// CLI entry point
if (require.main === module) {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error('Usage: node success_criteria.js <workDir>');
    process.exit(1);
  }
  const result = module.exports(workDir);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
