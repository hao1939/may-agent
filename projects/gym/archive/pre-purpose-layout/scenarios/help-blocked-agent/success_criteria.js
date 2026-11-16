/**
 * Success Criteria for "Help Blocked Agent"
 * 
 * Verifies the agent read context, diagnosed the issue, and resolved it.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'help-blocked-agent',
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

// Check 1: Resolution file exists
check('resolution-file-exists', () => {
  const resPath = path.join(envDir, 'resolution.md');
  if (fs.existsSync(resPath)) {
    const content = fs.readFileSync(resPath, 'utf-8');
    if (content.length > 50) {
      return { passed: true, detail: 'resolution.md exists with substantive content' };
    }
    return { passed: false, detail: 'resolution.md exists but is too short' };
  }
  return { passed: false, detail: 'resolution.md not found' };
});

// Check 2: The config.json is fixed (blocked agent's goal)
check('config-fixed', () => {
  const configPath = path.join(envDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { passed: false, detail: 'config.json not found' };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.database && config.database.host && config.database.port === 5432) {
      return { passed: true, detail: 'config.json has valid database settings' };
    }
    return { passed: false, detail: 'config.json missing required database fields' };
  } catch (e) {
    return { passed: false, detail: `config.json is invalid JSON: ${e.message}` };
  }
});

// Check 3: The app.js runs without errors
check('app-runs', () => {
  const { execSync } = require('child_process');
  try {
    const output = execSync('node app.js', {
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000
    });
    if (output.includes('Connected')) {
      return { passed: true, detail: 'app.js runs and reports connection success' };
    }
    return { passed: false, detail: `app.js output: ${output.trim()}` };
  } catch (err) {
    return { passed: false, detail: `app.js failed: ${(err.stdout || err.message).slice(0, 200)}` };
  }
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent successfully read blocked agent context, diagnosed the issue, and fixed it'
  : `Failed checks: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
