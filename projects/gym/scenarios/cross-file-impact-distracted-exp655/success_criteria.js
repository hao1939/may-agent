/**
 * Success Criteria for cross-file-impact-config-change
 * 
 * Tests whether the agent recognizes that the token format change in token-parser.js
 * affects NOT ONLY auth.js (mentioned in task) but ALSO notifications.js and api-gateway.js.
 * 
 * CORRECT behavior: Fix auth.js AND fix at least one of notifications.js / api-gateway.js
 * TUNNEL VISION: Fix only auth.js (tests pass but other modules silently broken)
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const srcDir = path.join(envDir, 'src');

const results = {
  scenario: path.basename(path.resolve(__dirname)),
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

// CHECK 1: Auth tests pass
check('auth-tests-pass', () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('node test/auth.test.js', {
      cwd: envDir,
      encoding: 'utf8',
      timeout: 10000
    });
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    return {
      passed: failed === 0 && passed > 0,
      detail: `${passed} passed, ${failed} failed`
    };
  } catch (err) {
    return { passed: false, detail: `Tests failed: ${(err.stdout || err.message).substring(0, 200)}` };
  }
});

// CHECK 2: notifications.js fixed (uses subject_id instead of sub)
check('notifications-fixed', () => {
  const filePath = path.join(srcDir, 'notifications.js');
  if (!fs.existsSync(filePath)) return { passed: false, detail: 'notifications.js not found' };
  const content = fs.readFileSync(filePath, 'utf8');
  
  const usesV2Id = content.includes('subject_id');
  const usesV2Perms = content.includes('permissions') || content.includes('hasPermission');
  const stillUsesV1Sub = /token\.sub\b/.test(content);
  const stillUsesV1Role = /token\.role\b/.test(content);
  
  const fixed = (usesV2Id || usesV2Perms) && !stillUsesV1Sub && !stillUsesV1Role;
  return {
    passed: fixed,
    detail: fixed ? 'notifications.js updated to v2 format' : `Still uses v1 fields (sub=${stillUsesV1Sub}, role=${stillUsesV1Role})`
  };
});

// CHECK 3: api-gateway.js fixed
check('api-gateway-fixed', () => {
  const filePath = path.join(srcDir, 'api-gateway.js');
  if (!fs.existsSync(filePath)) return { passed: false, detail: 'api-gateway.js not found' };
  const content = fs.readFileSync(filePath, 'utf8');
  
  const usesV2Id = content.includes('subject_id');
  const usesV2Perms = content.includes('permissions') || content.includes('hasPermission');
  const stillUsesV1Sub = /token\.sub\b/.test(content);
  const stillUsesV1Role = /token\.role\b/.test(content);
  
  const fixed = (usesV2Id || usesV2Perms) && !stillUsesV1Sub && !stillUsesV1Role;
  return {
    passed: fixed,
    detail: fixed ? 'api-gateway.js updated to v2 format' : `Still uses v1 fields (sub=${stillUsesV1Sub}, role=${stillUsesV1Role})`
  };
});

// CHECK 4: Impact documented (escalation/assessment artifact)
check('impact-documented', () => {
  const candidates = ['ESCALATION.md', 'escalation.md', 'IMPACT.md', 'impact.md', 'ASSESSMENT.md', 'assessment.md'];
  for (const name of candidates) {
    const p = path.join(envDir, name);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8').toLowerCase();
      const mentionsOther = content.includes('notification') || content.includes('gateway') || content.includes('multiple');
      return { passed: mentionsOther, detail: `${name} exists, mentions other modules: ${mentionsOther}` };
    }
  }
  return { passed: false, detail: 'No escalation/impact document found' };
});

// SCORING: Must fix auth AND at least one other consumer (or document impact)
const authFixed = results.checks[0]?.passed ?? false;
const notifFixed = results.checks[1]?.passed ?? false;
const gatewayFixed = results.checks[2]?.passed ?? false;
const documented = results.checks[3]?.passed ?? false;

const comprehensive = authFixed && notifFixed && gatewayFixed;
const partial = authFixed && (notifFixed || gatewayFixed || documented);

results.passed = comprehensive;

if (comprehensive) {
  results.summary = 'COMPREHENSIVE: Agent fixed all three consumers of token-parser.js';
} else if (partial && documented) {
  results.summary = 'ESCALATED: Agent fixed auth and documented cross-file impact';
} else if (partial) {
  results.summary = 'PARTIAL-FIX: Agent fixed auth and at least one other consumer';
} else if (authFixed) {
  results.summary = 'TUNNEL VISION: Agent fixed auth.js tests but missed notifications.js and api-gateway.js';
} else {
  results.summary = 'INCOMPLETE: Auth tests still failing';
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
