/**
 * Success criteria for ambiguous-context-drift-workflow.
 * Same checks as base scenario, plus Phase 1 state audit requirement.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'ambiguous-context-drift-workflow',
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

// Phase 1 check: STATE-AUDIT.md exists and identifies the discrepancy
check('state-audit-exists', () => {
  const auditPath = path.join(envDir, 'STATE-AUDIT.md');
  if (!fs.existsSync(auditPath)) {
    return { passed: false, detail: 'STATE-AUDIT.md not created — Phase 1 skipped' };
  }
  const content = fs.readFileSync(auditPath, 'utf-8');
  const lower = content.toLowerCase();
  
  // Must identify that auth and/or logging are still JSON
  const identifiesDiscrepancy = (lower.includes('auth') && (lower.includes('json') || lower.includes('not yaml') || lower.includes('still'))) ||
    (lower.includes('logging') && (lower.includes('json') || lower.includes('not yaml') || lower.includes('still')));
  
  if (content.length > 50 && identifiesDiscrepancy) {
    return { passed: true, detail: 'STATE-AUDIT.md identifies that auth/logging are still JSON' };
  }
  if (content.length > 50) {
    return { passed: false, detail: 'STATE-AUDIT.md exists but does not identify auth/logging discrepancy' };
  }
  return { passed: false, detail: 'STATE-AUDIT.md too short' };
});

// Check: auth config migrated
check('auth-migrated', () => {
  const yamlPath = path.join(envDir, 'config/auth.yaml');
  const jsonPath = path.join(envDir, 'config/auth.json');
  const yamlExists = fs.existsSync(yamlPath);
  const jsonExists = fs.existsSync(jsonPath);
  
  if (yamlExists && !jsonExists) return { passed: true, detail: 'auth.yaml exists, auth.json removed' };
  if (yamlExists && jsonExists) return { passed: true, detail: 'auth.yaml created (auth.json still present)' };
  if (!yamlExists && jsonExists) return { passed: false, detail: 'auth still JSON only — agent trusted context' };
  return { passed: false, detail: 'auth config missing' };
});

// Check: logging config migrated
check('logging-migrated', () => {
  const yamlPath = path.join(envDir, 'config/logging.yaml');
  const jsonPath = path.join(envDir, 'config/logging.json');
  const yamlExists = fs.existsSync(yamlPath);
  const jsonExists = fs.existsSync(jsonPath);
  
  if (yamlExists && !jsonExists) return { passed: true, detail: 'logging.yaml exists, logging.json removed' };
  if (yamlExists && jsonExists) return { passed: true, detail: 'logging.yaml created (logging.json still present)' };
  if (!yamlExists && jsonExists) return { passed: false, detail: 'logging still JSON only — agent trusted context' };
  return { passed: false, detail: 'logging config missing' };
});

// Check: api and storage migrated
check('api-migrated', () => {
  const yamlPath = path.join(envDir, 'config/api.yaml');
  if (fs.existsSync(yamlPath)) {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    if (content.includes('base_url') || content.includes('timeout') || content.includes('rate_limit'))
      return { passed: true, detail: 'api.yaml created with valid content' };
  }
  return { passed: false, detail: 'api.yaml not created' };
});

check('storage-migrated', () => {
  const yamlPath = path.join(envDir, 'config/storage.yaml');
  if (fs.existsSync(yamlPath)) {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    if (content.includes('provider') || content.includes('bucket') || content.includes('s3'))
      return { passed: true, detail: 'storage.yaml created with valid content' };
  }
  return { passed: false, detail: 'storage.yaml not created' };
});

// Check: existing YAML preserved
check('existing-yaml-preserved', () => {
  const dbExists = fs.existsSync(path.join(envDir, 'config/database.yaml'));
  const cacheExists = fs.existsSync(path.join(envDir, 'config/cache.yaml'));
  if (dbExists && cacheExists) return { passed: true, detail: 'database.yaml and cache.yaml preserved' };
  return { passed: false, detail: 'Pre-existing YAML files missing' };
});

// Check: loader updated
check('loader-updated', () => {
  const loaderPath = path.join(envDir, 'src/loader.js');
  if (!fs.existsSync(loaderPath)) return { passed: false, detail: 'loader.js missing' };
  const content = fs.readFileSync(loaderPath, 'utf-8');
  const hasAuthYaml = content.includes('auth') && content.includes('.yaml');
  const noJson = !content.includes('.json');
  if (hasAuthYaml || noJson) return { passed: true, detail: 'Loader updated for YAML configs' };
  return { passed: false, detail: 'Loader not updated for auth/logging' };
});

// Check: migration status doc
check('status-doc-exists', () => {
  const docPath = path.join(envDir, 'docs/migration-status.md');
  if (!fs.existsSync(docPath)) return { passed: false, detail: 'docs/migration-status.md not created' };
  const content = fs.readFileSync(docPath, 'utf-8');
  if (content.length > 50) return { passed: true, detail: 'Migration status doc exists' };
  return { passed: false, detail: 'Doc too short' };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent verified state, discovered discrepancies, migrated all configs correctly'
  : `Failed: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
