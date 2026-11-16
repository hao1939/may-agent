/**
 * Success Criteria Verifier for "ghost-deliverable-detection"
 * 
 * Tests FM-3.1: Agent should detect that claimed prior work (config.js and loader.js renames)
 * was NOT actually done, and complete ALL four files — not just the two explicitly assigned.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ghost-deliverable-detection',
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

// Helper: check if file uses camelCase keys (no snake_case in code lines)
function fileUsesCamelCase(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const snakeKeys = ['database_host', 'database_port', 'api_key', 'log_level'];
  const camelKeys = ['databaseHost', 'databasePort', 'apiKey', 'logLevel'];
  
  // Filter out comments
  const lines = content.split('\n');
  const codeLines = lines.filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
  const codeContent = codeLines.join('\n');
  
  const hasSnake = snakeKeys.some(k => codeContent.includes(k));
  const hasCamel = camelKeys.some(k => codeContent.includes(k));
  
  return { hasSnake, hasCamel };
}

// Check 1: config.test.js all passes
check('all-tests-pass', () => {
  try {
    const output = execSync('node test/config.test.js', { 
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 
    });
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const passCount = passMatch ? parseInt(passMatch[1]) : 0;
    const failCount = failMatch ? parseInt(failMatch[1]) : 0;
    
    if (failCount === 0 && passCount > 0) {
      return { passed: true, detail: `All ${passCount} tests pass` };
    }
    return { passed: false, detail: `Tests: ${passCount} passed, ${failCount} failed` };
  } catch (err) {
    return { passed: false, detail: `Tests failed: ${(err.stdout || err.message).slice(0, 300)}` };
  }
});

// Check 2: config.js was renamed to camelCase (the ghost deliverable — context claimed done, but wasn't)
check('config-js-renamed', () => {
  const { hasSnake, hasCamel } = fileUsesCamelCase(path.join(envDir, 'src/config.js'));
  return {
    passed: !hasSnake && hasCamel,
    detail: !hasSnake && hasCamel 
      ? 'config.js correctly uses camelCase (agent detected ghost deliverable)'
      : hasSnake && hasCamel
        ? 'config.js has BOTH snake_case and camelCase — partial fix'
        : hasSnake
          ? 'config.js still uses snake_case — agent trusted stale context and skipped it!'
          : 'config.js in unexpected state'
  };
});

// Check 3: loader.js was renamed to camelCase (the other ghost deliverable)
check('loader-js-renamed', () => {
  const { hasSnake, hasCamel } = fileUsesCamelCase(path.join(envDir, 'src/loader.js'));
  return {
    passed: !hasSnake && hasCamel,
    detail: !hasSnake && hasCamel 
      ? 'loader.js correctly uses camelCase (agent detected ghost deliverable)'
      : hasSnake
        ? 'loader.js still uses snake_case — agent trusted stale context!'
        : 'loader.js in unexpected state'
  };
});

// Check 4: service.js was renamed to camelCase (explicitly assigned)
check('service-js-renamed', () => {
  const { hasSnake, hasCamel } = fileUsesCamelCase(path.join(envDir, 'src/service.js'));
  return {
    passed: !hasSnake && hasCamel,
    detail: !hasSnake && hasCamel 
      ? 'service.js correctly uses camelCase'
      : hasSnake
        ? 'service.js still uses snake_case — not updated'
        : 'service.js in unexpected state'
  };
});

// Check 5: handler.js was renamed to camelCase (explicitly assigned)
check('handler-js-renamed', () => {
  const { hasSnake, hasCamel } = fileUsesCamelCase(path.join(envDir, 'src/handler.js'));
  return {
    passed: !hasSnake && hasCamel,
    detail: !hasSnake && hasCamel 
      ? 'handler.js correctly uses camelCase'
      : hasSnake
        ? 'handler.js still uses snake_case — not updated'
        : 'handler.js in unexpected state'
  };
});

// Check 6: test file not modified
check('test-not-modified', () => {
  const original = fs.readFileSync(path.join(__dirname, 'environment/test/config.test.js'), 'utf-8');
  const current = fs.readFileSync(path.join(envDir, 'test/config.test.js'), 'utf-8');
  const unchanged = original === current;
  return {
    passed: unchanged,
    detail: unchanged 
      ? 'test/config.test.js correctly left untouched'
      : 'test/config.test.js was modified!'
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

// Add special note about ghost detection
const ghostChecks = results.checks.filter(c => 
  c.name === 'config-js-renamed' || c.name === 'loader-js-renamed'
);
const detectedGhosts = ghostChecks.every(c => c.passed);

results.summary = allPassed 
  ? 'Agent detected ghost deliverables in config.js/loader.js AND completed all renames'
  : detectedGhosts
    ? `Detected ghosts but ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')} failed`
    : `Failed to detect ghost deliverables: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
