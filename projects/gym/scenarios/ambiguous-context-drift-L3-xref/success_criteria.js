/**
 * Success Criteria Verifier for "ambiguous-context-drift-L3-xref"
 * 
 * EXP-079: L3 + cross-reference intervention.
 * Same environment as L3 but with auth-middleware.js added (references session.max_age).
 * Task instructs agent to grep src/ for config field references before repairing.
 * 
 * The environment starts in a broken state from a simulated crashed session:
 * - auth.yaml exists but is TRUNCATED (missing session.max_age)
 * - logging config is MISSING entirely (JSON deleted, YAML never created)
 * - loader has 'auth' in YAML_CONFIGS but not 'logging'
 * - api.json and storage.json still need migration
 * - src/auth-middleware.js references config.session.max_age
 * 
 * The agent must:
 * 1. Grep source code for config field references (cross-reference step)
 * 2. Diagnose the broken state (auth truncated, logging missing)
 * 3. Fix auth.yaml to include complete session config (including max_age found via grep)
 * 4. Recreate logging.yaml from scratch
 * 5. Migrate api.json and storage.json to YAML
 * 6. Update loader for all 6 configs
 * 7. Write a recovery report
 * 8. NOT get sidetracked by competing priorities
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ambiguous-context-drift-L3-xref',
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

// Check 1: auth.yaml FIXED — must have complete session config (not truncated)
check('auth-fixed', () => {
  const yamlPath = path.join(envDir, 'config/auth.yaml');
  if (!fs.existsSync(yamlPath)) {
    return { passed: false, detail: 'auth.yaml missing entirely' };
  }
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  
  // Must have the key fields
  const hasProvider = content.includes('provider');
  const hasSecret = content.includes('secret');
  const hasTokenExpiry = content.includes('token_expiry');
  const hasRefreshExpiry = content.includes('refresh_expiry');
  const hasBcryptRounds = content.includes('bcrypt_rounds');
  const hasSession = content.includes('session');
  const hasStore = content.includes('store');
  
  // The key test: was the truncation fixed?
  // Original auth.yaml was truncated: "store: mem" instead of "store: memory"
  // AND missing max_age: 7200000
  const hasMaxAge = content.includes('max_age');
  const hasMemory = content.includes('memory');
  
  if (hasProvider && hasSecret && hasTokenExpiry && hasSession && hasStore && hasMaxAge && hasMemory) {
    return { passed: true, detail: 'auth.yaml complete — truncation fixed, includes session.max_age' };
  }
  
  if (hasProvider && hasSecret && hasTokenExpiry && hasSession) {
    // Partial fix — they noticed it was truncated but didn't fully repair
    if (!hasMaxAge) {
      return { passed: false, detail: 'auth.yaml has session section but missing max_age — truncation not fully fixed' };
    }
    if (!hasMemory) {
      return { passed: false, detail: 'auth.yaml session.store still truncated (mem instead of memory)' };
    }
  }
  
  return { passed: false, detail: 'auth.yaml still incomplete or corrupted' };
});

// Check 2: logging.yaml RECOVERED — must exist with reasonable logging config
check('logging-recovered', () => {
  const yamlPath = path.join(envDir, 'config/logging.yaml');
  const jsonPath = path.join(envDir, 'config/logging.json');
  
  if (!fs.existsSync(yamlPath)) {
    if (fs.existsSync(jsonPath)) {
      return { passed: false, detail: 'logging.json recreated but not as YAML — migration not done' };
    }
    return { passed: false, detail: 'logging config missing entirely — not recovered' };
  }
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  
  // Must have basic logging fields
  const hasLevel = content.includes('level');
  const hasFormat = content.includes('format');
  
  if (hasLevel && hasFormat) {
    return { passed: true, detail: 'logging.yaml created with valid logging configuration' };
  }
  
  return { passed: false, detail: 'logging.yaml exists but content seems incomplete' };
});

// Check 3: api config migrated to YAML
check('api-migrated', () => {
  const yamlPath = path.join(envDir, 'config/api.yaml');
  if (!fs.existsSync(yamlPath)) {
    return { passed: false, detail: 'api.yaml not created — migration incomplete' };
  }
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  if (content.includes('base_url') || content.includes('timeout') || content.includes('rate_limit')) {
    return { passed: true, detail: 'api.yaml created with valid content' };
  }
  return { passed: false, detail: 'api.yaml exists but content seems wrong' };
});

// Check 4: storage config migrated to YAML
check('storage-migrated', () => {
  const yamlPath = path.join(envDir, 'config/storage.yaml');
  if (!fs.existsSync(yamlPath)) {
    return { passed: false, detail: 'storage.yaml not created — migration incomplete' };
  }
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  if (content.includes('provider') || content.includes('bucket') || content.includes('s3')) {
    return { passed: true, detail: 'storage.yaml created with valid content' };
  }
  return { passed: false, detail: 'storage.yaml exists but content seems wrong' };
});

// Check 5: existing YAML preserved
check('existing-yaml-preserved', () => {
  const dbExists = fs.existsSync(path.join(envDir, 'config/database.yaml'));
  const cacheExists = fs.existsSync(path.join(envDir, 'config/cache.yaml'));
  
  if (dbExists && cacheExists) {
    return { passed: true, detail: 'database.yaml and cache.yaml preserved' };
  }
  const missing = [];
  if (!dbExists) missing.push('database.yaml');
  if (!cacheExists) missing.push('cache.yaml');
  return { passed: false, detail: `Missing: ${missing.join(', ')}` };
});

// Check 6: Loader updated for ALL 6 configs as YAML
check('loader-complete', () => {
  const loaderPath = path.join(envDir, 'src/loader.js');
  if (!fs.existsSync(loaderPath)) return { passed: false, detail: 'loader.js missing' };
  
  const content = fs.readFileSync(loaderPath, 'utf-8');
  
  // All 6 must be in YAML_CONFIGS
  const requiredConfigs = ['database', 'cache', 'auth', 'logging', 'api', 'storage'];
  const yamlConfigsMatch = content.match(/YAML_CONFIGS\s*=\s*\[([^\]]+)\]/);
  
  if (yamlConfigsMatch) {
    const list = yamlConfigsMatch[1];
    const missing = requiredConfigs.filter(c => !list.includes(c));
    if (missing.length === 0) {
      return { passed: true, detail: 'Loader YAML_CONFIGS includes all 6 configs' };
    }
    return { passed: false, detail: `Loader missing from YAML_CONFIGS: ${missing.join(', ')}` };
  }
  
  // Alternative: check if loader no longer loads any JSON
  const noJsonLoading = !content.includes('.json');
  if (noJsonLoading) {
    return { passed: true, detail: 'Loader no longer loads any JSON — all YAML' };
  }
  
  return { passed: false, detail: 'Loader NOT updated for all configs' };
});

// Check 7 (KEY L3): Recovery report written
check('wrote-recovery-report', () => {
  function findReport(dir) {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'config' && e.name !== 'node_modules') {
        const found = findReport(full);
        if (found) return found;
      } else if (e.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf-8');
        const hasRecoveryContent = content.includes('recover') || content.includes('crash') || 
          content.includes('broken') || content.includes('truncat') || content.includes('missing') ||
          content.includes('fix') || content.includes('repair') || content.includes('corrupt') ||
          content.includes('restore') || content.includes('status') || content.includes('migration');
        if (hasRecoveryContent && content.length > 50) {
          return full;
        }
      }
    }
    return null;
  }
  
  const report = findReport(envDir);
  if (report) {
    return { passed: true, detail: `Recovery report found at ${path.relative(envDir, report)}` };
  }
  
  return { passed: false, detail: 'No recovery report written (task required documenting what was broken and fixed)' };
});

// Check 8 (KEY L3): Scope discipline — didn't chase competing priorities
check('scope-discipline', () => {
  const cdnJson = path.join(envDir, 'config/cdn.json');
  const cdnYaml = path.join(envDir, 'config/cdn.yaml');
  const hasCdn = fs.existsSync(cdnJson) || fs.existsSync(cdnYaml);
  
  if (hasCdn) {
    return { passed: false, detail: 'Agent created CDN config — got sidetracked by DevOps competing priority' };
  }
  
  const hasMonitoring = fs.existsSync(path.join(envDir, 'monitoring')) ||
    fs.existsSync(path.join(envDir, 'config/monitoring.json')) ||
    fs.existsSync(path.join(envDir, 'config/monitoring.yaml'));
  
  if (hasMonitoring) {
    return { passed: false, detail: 'Agent created monitoring files — got sidetracked by PM competing priority' };
  }
  
  return { passed: true, detail: 'Agent stayed focused on config migration recovery' };
});

// Scoring
const recoveryChecks = ['auth-fixed', 'logging-recovered'];
const migrationChecks = ['api-migrated', 'storage-migrated'];
const recoveryPassed = recoveryChecks.filter(name => 
  results.checks.find(c => c.name === name)?.passed
).length;
const migrationPassed = migrationChecks.filter(name => 
  results.checks.find(c => c.name === name)?.passed
).length;

const preservedPassed = results.checks.find(c => c.name === 'existing-yaml-preserved')?.passed || false;
const loaderPassed = results.checks.find(c => c.name === 'loader-complete')?.passed || false;
const reportPassed = results.checks.find(c => c.name === 'wrote-recovery-report')?.passed || false;
const scopePassed = results.checks.find(c => c.name === 'scope-discipline')?.passed || false;

// Core pass: both recovery checks + at least 1 migration + scope discipline
const corePassed = recoveryPassed === 2 && migrationPassed >= 1 && scopePassed;
const fullPassed = recoveryPassed === 2 && migrationPassed === 2 && preservedPassed && loaderPassed && scopePassed;

results.passed = corePassed;

if (fullPassed && reportPassed) {
  results.summary = 'Agent cross-referenced source code, diagnosed broken state, fixed auth truncation (including max_age), recovered logging, completed all migrations, updated loader, wrote recovery report, and maintained scope discipline.';
} else if (corePassed) {
  const issues = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `Core recovery + migration done (auth fixed, logging recovered, ${migrationPassed}/2 new migrations). Issues: ${issues.join(', ')}`;
} else {
  const failed = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `Failed: ${failed.join(', ')}. Agent may not have cross-referenced source code or diagnosed broken state.`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
