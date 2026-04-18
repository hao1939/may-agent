/**
 * Success Criteria for "multi-file-verify-gap"
 *
 * Reproduces FM-3.3 pattern: agent renames function in source + test,
 * runs test (passes), but forgets to update one consumer file that uses
 * a different import pattern. The test file doesn't exercise the consumers.
 *
 * Full success requires:
 *   1. Rename loadConfig → getConfig in config-loader.js
 *   2. Update test-config.js import
 *   3. Update server.js import  
 *   4. Update health-check.js import (uses configLoader.loadConfig pattern)
 *   5. All files work without errors
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const workDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'multi-file-verify-gap', passed: false, checks: [], summary: '' };

function addCheck(name, passed, detail) {
  results.checks.push({ name, passed, detail });
}

function readFile(name) {
  try { return fs.readFileSync(path.join(workDir, name), 'utf8'); }
  catch { return null; }
}

const configCode = readFile('config-loader.js');
const serverCode = readFile('server.js');
const healthCode = readFile('health-check.js');
const testCode = readFile('test-config.js');

if (!configCode || !serverCode || !healthCode || !testCode) {
  addCheck('files-exist', false, 'One or more required files missing');
  results.summary = 'Missing files';
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// P1: config-loader.js exports getConfig (not loadConfig)
const hasGetConfig = configCode.includes('function getConfig') && configCode.includes('module.exports') && configCode.includes('getConfig');
const hasLoadConfig = configCode.includes('function loadConfig');
addCheck('P1-renamed-export', hasGetConfig && !hasLoadConfig,
  hasGetConfig && !hasLoadConfig
    ? 'config-loader.js exports getConfig'
    : 'config-loader.js still has loadConfig'
);

// P2: test-config.js updated
const testUsesGetConfig = testCode.includes('getConfig') && !testCode.includes('loadConfig');
addCheck('P2-test-updated', testUsesGetConfig,
  testUsesGetConfig
    ? 'test-config.js uses getConfig'
    : 'test-config.js still references loadConfig'
);

// P3: server.js updated  
const serverUsesGetConfig = serverCode.includes('getConfig') && !serverCode.includes('loadConfig');
addCheck('P3-server-updated', serverUsesGetConfig,
  serverUsesGetConfig
    ? 'server.js uses getConfig'
    : 'server.js still references loadConfig'
);

// P4: health-check.js updated (the likely FM-3.3 miss — different import pattern)
const healthUsesGetConfig = healthCode.includes('getConfig') && !healthCode.includes('loadConfig');
addCheck('P4-health-check-updated', healthUsesGetConfig,
  healthUsesGetConfig
    ? 'health-check.js uses getConfig'
    : 'health-check.js still references loadConfig'
);

// P5: Config tests pass
let testOutput = '';
let testOk = false;
try {
  testOutput = execSync('node test-config.js', { cwd: workDir, timeout: 10000, stdio: 'pipe' }).toString();
  testOk = true;
} catch (e) {
  testOutput = e.stdout ? e.stdout.toString() : e.message;
}
addCheck('P5-config-tests-pass', testOk,
  testOk ? 'Config tests pass' : `Config tests fail: ${testOutput.slice(-200)}`
);

// B1: server.js actually works (can be required without error)
let serverWorks = false;
try {
  const out = execSync('node -e "const s = require(\'./server\'); s.createServer(); console.log(\'OK\')"', 
    { cwd: workDir, timeout: 5000, stdio: 'pipe' }).toString();
  serverWorks = out.includes('OK');
} catch (e) {
  // fails
}
addCheck('B1-server-works', serverWorks,
  serverWorks ? 'server.js loads without error' : 'server.js fails to load'
);

// B2: health-check.js actually works (the critical FM-3.3 check)
let healthWorks = false;
try {
  const out = execSync('node -e "const h = require(\'./health-check\'); h.getHealthStatus(); console.log(\'OK\')"',
    { cwd: workDir, timeout: 5000, stdio: 'pipe' }).toString();
  healthWorks = out.includes('OK');
} catch (e) {
  // fails — this is the FM-3.3 gap
}
addCheck('B2-health-check-works', healthWorks,
  healthWorks 
    ? 'health-check.js loads and works' 
    : 'health-check.js fails — missed the configLoader.loadConfig pattern'
);

const passedCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;
results.passed = passedCount === totalCount;
results.summary = `${passedCount}/${totalCount} checks passed`;

console.log(JSON.stringify(results, null, 2));
