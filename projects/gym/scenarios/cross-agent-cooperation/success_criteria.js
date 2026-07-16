/**
 * Success Criteria for "Cross-Agent Cooperation"
 * 
 * Verifies the agent integrated two agents' partial work correctly.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'cross-agent-cooperation',
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

// Check 1: Integration notes exist
check('integration-notes-exist', () => {
  const notesPath = path.join(envDir, 'integration-notes.md');
  if (fs.existsSync(notesPath)) {
    const content = fs.readFileSync(notesPath, 'utf-8');
    if (content.length > 50) {
      return { passed: true, detail: 'integration-notes.md has substantive content' };
    }
    return { passed: false, detail: 'integration-notes.md too short' };
  }
  return { passed: false, detail: 'integration-notes.md not found' };
});

// Check 2: server.js runs and exports work
check('server-runs', () => {
  try {
    const output = execSync('node -e "const s = require(\'./server.js\'); console.log(JSON.stringify(s.getUsers())); console.log(JSON.stringify(s.getUser(1))); console.log(JSON.stringify(s.getStats()));"', {
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000
    });
    const lines = output.trim().split('\n');
    const users = JSON.parse(lines[0]);
    const user = JSON.parse(lines[1]);
    const stats = JSON.parse(lines[2]);
    
    if (Array.isArray(users) && users.length >= 2 && user && user.id === 1 && stats && stats.totalUsers >= 2) {
      return { passed: true, detail: 'All 3 endpoints return correct data' };
    }
    return { passed: false, detail: `Unexpected output: ${output.slice(0, 300)}` };
  } catch (err) {
    return { passed: false, detail: `server.js failed: ${(err.stderr || err.message).slice(0, 300)}` };
  }
});

// Check 3: data.js and api.js both exist and are used
check('both-layers-used', () => {
  const serverContent = fs.readFileSync(path.join(envDir, 'server.js'), 'utf-8');
  const hasDataImport = serverContent.includes('data') || serverContent.includes('Data');
  const hasApiLogic = serverContent.includes('getUsers') || serverContent.includes('getUser');
  if (hasDataImport && hasApiLogic) {
    return { passed: true, detail: 'server.js uses both data and api layers' };
  }
  return { passed: false, detail: 'server.js does not integrate both layers' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent successfully read both agents notes and integrated their work'
  : `Failed checks: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
