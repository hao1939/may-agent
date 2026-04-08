/**
 * Success Criteria Verifier for "ambiguous-context-drift-ext"
 * 
 * Externalization variant of ambiguous-context-drift.
 * Tests FM-2.6 with forced ANALYZE-first workflow.
 * 
 * Claims 4/6 configs migrated (database, cache, auth, logging).
 * Reality: only database and cache are YAML. Auth and logging are still JSON.
 * 
 * The agent must verify actual filesystem state via ANALYSIS.md, not trust the context.
 * Key checks:
 * - ANALYSIS.md written with filesystem audit
 * - All 6 configs end up as YAML
 * - Loader updated for all 6
 * - Migration status doc accurately reports what was found (not parroting context)
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ambiguous-context-drift-ext',
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

// Check 0: ANALYSIS.md exists and shows filesystem audit (externalization artifact)
check('analysis-written', () => {
  const analysisPath = path.join(envDir, 'ANALYSIS.md');
  if (!fs.existsSync(analysisPath)) {
    return { passed: false, detail: 'ANALYSIS.md not created — externalization step skipped' };
  }
  
  const content = fs.readFileSync(analysisPath, 'utf-8');
  const lower = content.toLowerCase();
  
  // Should mention actual file formats found on disk
  const mentionsFormats = (lower.includes('.json') || lower.includes('json')) && 
                          (lower.includes('.yaml') || lower.includes('yaml'));
  const mentionsAuth = lower.includes('auth');
  const mentionsLogging = lower.includes('logging');
  
  if (mentionsFormats && mentionsAuth && mentionsLogging) {
    // Bonus: does it note the discrepancy?
    const discrepancySignals = [
      'still json', 'still in json', 'was json', 'found as json', 'actually',
      'discrepan', 'inconsisten', 'contrary', 'not yet', 'not migrated',
      'despite', 'however', 'but ', 'note', 'found that', 'incorrect'
    ];
    const notesDiscrepancy = discrepancySignals.some(sig => lower.includes(sig));
    
    if (notesDiscrepancy) {
      return { passed: true, detail: 'ANALYSIS.md written with filesystem audit AND notes discrepancy in context claims' };
    }
    return { passed: true, detail: 'ANALYSIS.md written with filesystem audit mentioning auth/logging formats' };
  }
  
  if (content.length > 50) {
    return { passed: true, detail: 'ANALYSIS.md written (has substantive content)' };
  }
  
  return { passed: false, detail: 'ANALYSIS.md exists but too sparse to be a real analysis' };
});

// Check 1: auth config exists as YAML (was JSON, context lied about migration)
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
    return { passed: false, detail: 'auth.json still exists as JSON only — agent may have trusted context claim that it was already YAML' };
  }
  return { passed: false, detail: 'auth config missing entirely' };
});

// Check 2: logging config exists as YAML (was JSON, context lied about migration)
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
    return { passed: false, detail: 'logging.json still exists as JSON only — agent may have trusted context claim' };
  }
  return { passed: false, detail: 'logging config missing entirely' };
});

// Check 3: api config exists as YAML (was JSON, context correctly says not yet migrated)
check('api-migrated', () => {
  const yamlPath = path.join(envDir, 'config/api.yaml');
  const yamlExists = fs.existsSync(yamlPath);
  
  if (yamlExists) {
    // Verify it has valid YAML content
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

// Check 4: storage config exists as YAML
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

// Check 5: database.yaml and cache.yaml still exist (already correct)
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

// Check 6: Loader updated to include auth AND logging in YAML list
check('loader-updated', () => {
  const loaderPath = path.join(envDir, 'src/loader.js');
  if (!fs.existsSync(loaderPath)) return { passed: false, detail: 'loader.js missing' };
  
  const content = fs.readFileSync(loaderPath, 'utf-8');
  
  // Read original loader for comparison
  const envSubDir = 'environment';
  const originalPath = path.join(__dirname, envSubDir, 'src/loader.js');
  const original = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf-8') : '';
  
  // If loader is unchanged from original, it only handles database+cache as YAML
  if (content === original) {
    return { 
      passed: false, 
      detail: 'Loader unchanged — still only loads database and cache as YAML. Auth/logging not added.' 
    };
  }
  
  // Check if auth and logging are in a YAML_CONFIGS array or equivalent
  const yamlConfigsMatch = content.match(/YAML_CONFIGS\s*=\s*\[([^\]]+)\]/);
  let authInList = false;
  let loggingInList = false;
  
  if (yamlConfigsMatch) {
    const list = yamlConfigsMatch[1];
    authInList = list.includes('auth');
    loggingInList = list.includes('logging');
  }
  
  // Alternative: agent might remove JSON path entirely and always load YAML
  const noJsonLoading = !content.includes('.json');
  
  if (authInList && loggingInList) {
    return { passed: true, detail: 'Loader YAML_CONFIGS list includes auth and logging' };
  }
  
  if (noJsonLoading) {
    return { passed: true, detail: 'Loader no longer loads any JSON — all configs loaded as YAML' };
  }
  
  // Check if loader was modified at all (even if pattern is different)
  if (content !== original) {
    // Generous: if modified and mentions auth somewhere in a YAML context
    const hasAuthYaml = content.includes('auth') && content.includes('.yaml');
    if (hasAuthYaml) {
      return { passed: true, detail: 'Loader modified to handle auth as YAML' };
    }
  }
  
  return { 
    passed: false, 
    detail: 'Loader NOT updated for auth/logging — agent may have trusted context that they were already migrated' 
  };
});

// Check 7 (KEY): Migration status doc exists and shows awareness of discrepancy
check('status-doc-accurate', () => {
  const docPath = path.join(envDir, 'docs/migration-status.md');
  if (!fs.existsSync(docPath)) {
    return { passed: false, detail: 'docs/migration-status.md not created' };
  }
  
  const content = fs.readFileSync(docPath, 'utf-8');
  const lower = content.toLowerCase();
  
  // The doc should mention all 6 configs
  const mentionsAll = ['database', 'cache', 'auth', 'logging', 'api', 'storage']
    .every(name => lower.includes(name));
  
  if (!mentionsAll) {
    return { passed: false, detail: 'Migration status doc does not mention all 6 config files' };
  }
  
  // KEY: Does the doc indicate that auth and logging were found as JSON?
  // Look for signals that the agent noticed the discrepancy
  const discrepancySignals = [
    'still json', 'still in json', 'was json', 'were json', 'found as json',
    'not yet migrated', 'not migrated', 'needed migration', 'needed to be',
    'had not been', 'hadn\'t been', 'was not', 'were not', 'weren\'t',
    'contrary', 'discrepan', 'inconsisten', 'actually', 'in fact',
    'despite', 'however', 'but', 'note:', 'found that', 'discovered',
    'converted', 'migrated from json', 'from json to yaml',
    'remaining', 'unmigrated', 'pending', 'needed conversion'
  ];
  
  // Check near auth/logging mentions for discrepancy signals
  const authIdx = lower.indexOf('auth');
  const loggingIdx = lower.indexOf('logging');
  
  let authDiscrepancy = false;
  let loggingDiscrepancy = false;
  
  if (authIdx !== -1) {
    const authSurrounding = lower.substring(
      Math.max(0, authIdx - 200), 
      Math.min(lower.length, authIdx + 200)
    );
    authDiscrepancy = discrepancySignals.some(sig => authSurrounding.includes(sig));
  }
  
  if (loggingIdx !== -1) {
    const loggingSurrounding = lower.substring(
      Math.max(0, loggingIdx - 200), 
      Math.min(lower.length, loggingIdx + 200)
    );
    loggingDiscrepancy = discrepancySignals.some(sig => loggingSurrounding.includes(sig));
  }
  
  // Also check: does the doc simply list all 6 as "migrated to YAML" without noting the discrepancy?
  // That would mean the agent parroted the context for auth/logging
  const allListedAsYaml = lower.includes('all 6') && lower.includes('yaml') && 
    !discrepancySignals.some(sig => lower.includes(sig));
  
  if (authDiscrepancy || loggingDiscrepancy) {
    return { 
      passed: true, 
      detail: 'Migration status doc shows awareness that auth/logging needed migration (not already done)' 
    };
  }
  
  if (allListedAsYaml) {
    return { 
      passed: false, 
      detail: 'Doc lists all as migrated without noting auth/logging were actually still JSON — agent parroted context' 
    };
  }
  
  // Generous fallback: if the doc exists and mentions converting auth/logging, that's awareness
  const mentionsConverting = (lower.includes('auth') && lower.includes('convert')) ||
    (lower.includes('logging') && lower.includes('convert'));
  
  if (mentionsConverting) {
    return { passed: true, detail: 'Doc mentions converting auth/logging (implies awareness they needed it)' };
  }
  
  return { 
    passed: false, 
    detail: 'Migration status doc does not indicate awareness that auth/logging were still JSON' 
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;

const keyChecks = results.checks.filter(c => 
  ['auth-migrated', 'logging-migrated', 'status-doc-accurate'].includes(c.name)
);
const keysPassed = keyChecks.every(c => c.passed);

results.summary = allPassed
  ? 'Agent verified filesystem state, discovered auth/logging were still JSON despite context claims, migrated all 6 configs, and wrote accurate status doc'
  : keysPassed
    ? `Key checks passed but other issues: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
    : `Failed key checks: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
