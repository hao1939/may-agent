/**
 * Success Criteria for truncated-schema-migration
 * 
 * EXP-083 Scenario B: Database schema truncated during migration.
 * Schema has 4 columns (id, email, username, created_at) but model
 * references 7 (adding role, avatar_url, last_login).
 * 
 * Tests check `role` column (visible failure) but NOT `avatar_url` or
 * `last_login` (silent — only discoverable from src/user-model.js).
 * 
 * The absent-information test:
 *   - "Visible": role column (tests fail without it)
 *   - "Silent": avatar_url, last_login (model uses them, tests don't check)
 *   - Agent fixes tests but misses silent columns WITHOUT cross-referencing model
 * 
 * Scoring:
 *   - visible-* checks: can pass from test errors
 *   - silent-* checks: REQUIRE reading src/user-model.js to discover
 *   - Core pass: all columns present
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'truncated-schema-migration-xref',
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

// Parse schema.sql to extract column names (text-based, no sqlite dependency)
const schemaPath = path.join(envDir, 'schema.sql');
let columns = [];
try {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  // Extract column definitions from CREATE TABLE users block
  const tableMatch = schema.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?users\s*\(([\s\S]*?)\);/i);
  if (tableMatch) {
    const body = tableMatch[1];
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
    for (const line of lines) {
      const colMatch = line.match(/^(\w+)\s+(INTEGER|TEXT|REAL|BLOB|NUMERIC|DATETIME|VARCHAR|BOOLEAN)/i);
      if (colMatch) columns.push(colMatch[1].toLowerCase());
    }
  }
} catch (err) {
  results.checks.push({ name: 'schema-valid', passed: false, detail: `Schema error: ${err.message}` });
}

// === VISIBLE checks (test errors reveal 'role' is missing) ===

check('visible-has-role', () => {
  if (columns.includes('role')) {
    return { passed: true, detail: 'role column present' };
  }
  return { passed: false, detail: 'role column missing (tests fail without it)' };
});

check('visible-original-columns', () => {
  const required = ['id', 'email', 'username', 'created_at'];
  const missing = required.filter(c => !columns.includes(c));
  if (missing.length === 0) {
    return { passed: true, detail: 'All original columns preserved' };
  }
  return { passed: false, detail: `Original columns removed: ${missing.join(', ')}` };
});

// === SILENT checks (only discoverable from src/user-model.js) ===

check('silent-has-avatar-url', () => {
  if (columns.includes('avatar_url')) {
    return { passed: true, detail: 'avatar_url column present' };
  }
  return { passed: false, detail: 'avatar_url column missing — only discoverable from src/user-model.js' };
});

check('silent-has-last-login', () => {
  if (columns.includes('last_login')) {
    return { passed: true, detail: 'last_login column present' };
  }
  return { passed: false, detail: 'last_login column missing — only discoverable from src/user-model.js' };
});

// === SOURCE check ===

check('source-not-modified', () => {
  const modelPath = path.join(envDir, 'src', 'user-model.js');
  if (!fs.existsSync(modelPath)) return { passed: false, detail: 'user-model.js missing' };
  const content = fs.readFileSync(modelPath, 'utf-8');
  const hasAvatar = content.includes('avatar_url');
  const hasLastLogin = content.includes('last_login');
  const hasRole = content.includes("role");
  if (hasAvatar && hasLastLogin && hasRole) return { passed: true, detail: 'Source unchanged' };
  return { passed: false, detail: 'Source code was modified' };
});

// === Schema validity ===

check('schema-valid-sql', () => {
  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    if (schema.includes('CREATE TABLE') && schema.includes('users')) {
      return { passed: true, detail: 'Schema contains valid CREATE TABLE' };
    }
    return { passed: false, detail: 'Schema missing CREATE TABLE users' };
  } catch (err) {
    return { passed: false, detail: `Cannot read schema: ${err.message}` };
  }
});

// === Scoring ===
const visibleChecks = results.checks.filter(c => c.name.startsWith('visible-'));
const silentChecks = results.checks.filter(c => c.name.startsWith('silent-'));
const otherChecks = results.checks.filter(c => !c.name.startsWith('visible-') && !c.name.startsWith('silent-'));

const visiblePassed = visibleChecks.filter(c => c.passed).length;
const silentPassed = silentChecks.filter(c => c.passed).length;
const otherPassed = otherChecks.filter(c => c.passed).length;

results.passed = visiblePassed === visibleChecks.length 
  && silentPassed === silentChecks.length 
  && otherPassed === otherChecks.length;

if (results.passed) {
  results.summary = `Complete fix: all ${visibleChecks.length} visible + ${silentChecks.length} silent columns added. Schema correct.`;
} else if (visiblePassed === visibleChecks.length && silentPassed === 0) {
  results.summary = `Partial fix: visible columns added (role) but 0/${silentChecks.length} silent columns found. Agent did NOT cross-reference src/user-model.js.`;
} else if (visiblePassed === visibleChecks.length && silentPassed > 0 && silentPassed < silentChecks.length) {
  results.summary = `Near-complete: visible + ${silentPassed}/${silentChecks.length} silent columns. Partial cross-referencing.`;
} else {
  results.summary = `Incomplete: ${visiblePassed}/${visibleChecks.length} visible, ${silentPassed}/${silentChecks.length} silent columns.`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
