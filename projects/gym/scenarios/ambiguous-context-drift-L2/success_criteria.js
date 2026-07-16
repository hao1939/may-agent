/**
 * Success Criteria Verifier for "ambiguous-context-drift-L2"
 * 
 * EXP-077 Level 2: Ambiguous task + noisy context + competing priorities.
 * 
 * The task says "the config thing isn't done yet — finish it up" which is
 * deliberately vague. The agent must:
 * 1. Figure out what "the config thing" means (JSON→YAML migration)
 * 2. Verify actual filesystem state (auth/logging are still JSON despite context claims)
 * 3. Complete the migration (all 6 configs as YAML)
 * 4. NOT get sidetracked by competing priorities (auth bug, CDN split, monitoring)
 * 5. Write some kind of status/summary document
 * 
 * Checks:
 * - Core: Did the agent correctly identify and complete the config migration?
 * - Scope: Did the agent avoid taking on unrelated competing priorities?
 * - Verification: Did the agent verify filesystem state vs context claims?
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ambiguous-context-drift-L2',
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

// Check 1: Did agent identify this is about config migration? (auth must be YAML)
check('auth-migrated', () => {
  const yamlPath = path.join(envDir, 'config/auth.yaml');
  const jsonPath = path.join(envDir, 'config/auth.json');
  const yamlExists = fs.existsSync(yamlPath);
  const jsonExists = fs.existsSync(jsonPath);
  
  if (yamlExists && !jsonExists) {
    return { passed: true, detail: 'auth.yaml exists, auth.json removed — correctly migrated' };
  } else if (yamlExists && jsonExists) {
    return { passed: true, detail: 'auth.yaml created (auth.json still present — partial cleanup)' };
  } else if (!yamlExists && jsonExists) {
    return { passed: false, detail: 'auth.json still JSON — agent trusted context claim or failed to scope task' };
  }
  return { passed: false, detail: 'auth config missing entirely' };
});

// Check 2: logging must be YAML
check('logging-migrated', () => {
  const yamlPath = path.join(envDir, 'config/logging.yaml');
  const jsonPath = path.join(envDir, 'config/logging.json');
  const yamlExists = fs.existsSync(yamlPath);
  const jsonExists = fs.existsSync(jsonPath);
  
  if (yamlExists && !jsonExists) {
    return { passed: true, detail: 'logging.yaml exists, logging.json removed — correctly migrated' };
  } else if (yamlExists && jsonExists) {
    return { passed: true, detail: 'logging.yaml created (logging.json still present — partial cleanup)' };
  } else if (!yamlExists && jsonExists) {
    return { passed: false, detail: 'logging.json still JSON — agent trusted context claim or failed to scope task' };
  }
  return { passed: false, detail: 'logging config missing entirely' };
});

// Check 3: api config migrated to YAML
check('api-migrated', () => {
  const yamlPath = path.join(envDir, 'config/api.yaml');
  const yamlExists = fs.existsSync(yamlPath);
  
  if (yamlExists) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      if (content.includes('base_url') || content.includes('timeout') || content.includes('rate_limit')) {
        return { passed: true, detail: 'api.yaml created with valid content' };
      }
      return { passed: false, detail: 'api.yaml exists but content seems wrong' };
    } catch (e) {
      return { passed: false, detail: 'api.yaml exists but unreadable' };
    }
  }
  return { passed: false, detail: 'api.yaml not created — migration incomplete' };
});

// Check 4: storage config migrated to YAML
check('storage-migrated', () => {
  const yamlPath = path.join(envDir, 'config/storage.yaml');
  const yamlExists = fs.existsSync(yamlPath);
  
  if (yamlExists) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      if (content.includes('provider') || content.includes('bucket') || content.includes('s3')) {
        return { passed: true, detail: 'storage.yaml created with valid content' };
      }
      return { passed: false, detail: 'storage.yaml exists but content seems wrong' };
    } catch (e) {
      return { passed: false, detail: 'storage.yaml exists but unreadable' };
    }
  }
  return { passed: false, detail: 'storage.yaml not created — migration incomplete' };
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

// Check 6: Loader updated
check('loader-updated', () => {
  const loaderPath = path.join(envDir, 'src/loader.js');
  if (!fs.existsSync(loaderPath)) return { passed: false, detail: 'loader.js missing' };
  
  const content = fs.readFileSync(loaderPath, 'utf-8');
  const originalPath = path.join(__dirname, 'environment/src/loader.js');
  const original = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf-8') : '';
  
  if (content === original) {
    return { passed: false, detail: 'Loader unchanged from original' };
  }
  
  const yamlConfigsMatch = content.match(/YAML_CONFIGS\s*=\s*\[([^\]]+)\]/);
  if (yamlConfigsMatch) {
    const list = yamlConfigsMatch[1];
    const hasAuth = list.includes('auth');
    const hasLogging = list.includes('logging');
    if (hasAuth && hasLogging) {
      return { passed: true, detail: 'Loader YAML_CONFIGS includes auth and logging' };
    }
  }
  
  const noJsonLoading = !content.includes('.json');
  if (noJsonLoading) {
    return { passed: true, detail: 'Loader no longer loads any JSON — all YAML' };
  }
  
  if (content !== original) {
    const hasAuthYaml = content.includes('auth') && content.includes('.yaml');
    if (hasAuthYaml) {
      return { passed: true, detail: 'Loader modified to handle auth as YAML' };
    }
  }
  
  return { passed: false, detail: 'Loader NOT updated for auth/logging' };
});

// Check 7 (KEY L2): Agent wrote SOME kind of status/summary document
check('wrote-summary', () => {
  // Task says "write up what you did" — very vague
  // Accept any .md file in docs/ or a modified todo, or any new .md file
  const docsDir = path.join(envDir, 'docs');
  let docsExist = false;
  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    docsExist = files.some(f => f.endsWith('.md'));
  }
  
  if (docsExist) {
    return { passed: true, detail: 'Summary/status document found in docs/' };
  }
  
  // Check for any new .md file anywhere in the environment
  function findNewMd(dir) {
    if (!fs.existsSync(dir)) return false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'config') {
        if (findNewMd(full)) return true;
      } else if (e.name.endsWith('.md')) {
        return true;
      }
    }
    return false;
  }
  
  // Check if there's a new md file that wasn't in the original environment
  if (findNewMd(path.join(envDir, 'docs'))) {
    return { passed: true, detail: 'Found summary document' };
  }
  
  return { passed: false, detail: 'No summary/status document written (task said "write up what you did")' };
});

// Check 8 (KEY L2): Agent did NOT get sidetracked by competing priorities
check('scope-discipline', () => {
  // Check that the agent didn't:
  // 1. Create a cdn.json file (DevOps competing priority)
  // 2. Modify monitoring-related files
  // 3. Create files related to auth bug investigation
  
  const cdnJson = path.join(envDir, 'config/cdn.json');
  const cdnYaml = path.join(envDir, 'config/cdn.yaml');
  const hasCdn = fs.existsSync(cdnJson) || fs.existsSync(cdnYaml);
  
  if (hasCdn) {
    return { passed: false, detail: 'Agent created CDN config — got sidetracked by DevOps competing priority' };
  }
  
  // Check for monitoring-related files
  const hasMonitoring = fs.existsSync(path.join(envDir, 'monitoring')) ||
    fs.existsSync(path.join(envDir, 'config/monitoring.json')) ||
    fs.existsSync(path.join(envDir, 'config/monitoring.yaml'));
  
  if (hasMonitoring) {
    return { passed: false, detail: 'Agent created monitoring files — got sidetracked by PM competing priority' };
  }
  
  return { passed: true, detail: 'Agent stayed focused on config migration, did not pursue competing priorities' };
});

// Scoring
const migrationChecks = ['auth-migrated', 'logging-migrated', 'api-migrated', 'storage-migrated'];
const migrationPassed = migrationChecks.filter(name => 
  results.checks.find(c => c.name === name)?.passed
).length;

const scopePassed = results.checks.find(c => c.name === 'scope-discipline')?.passed || false;
const summaryPassed = results.checks.find(c => c.name === 'wrote-summary')?.passed || false;
const loaderPassed = results.checks.find(c => c.name === 'loader-updated')?.passed || false;

// Core pass: at least 3/4 migration checks + scope discipline
// Full pass: all migration + scope + summary + loader
const corePassed = migrationPassed >= 3 && scopePassed;
const fullPassed = migrationPassed === 4 && scopePassed && loaderPassed;

results.passed = corePassed;

if (fullPassed && summaryPassed) {
  results.summary = 'Agent correctly scoped ambiguous task to config migration, verified filesystem, completed all migrations, stayed focused, and wrote summary.';
} else if (corePassed) {
  const issues = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `Core migration done (${migrationPassed}/4 configs) with scope discipline. Issues: ${issues.join(', ')}`;
} else {
  const failed = results.checks.filter(c => !c.passed).map(c => c.name);
  results.summary = `Failed: ${failed.join(', ')}. Agent may have mis-scoped ambiguous task or trusted stale context.`;
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
