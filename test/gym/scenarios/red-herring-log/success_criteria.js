/**
 * Success Criteria Verifier for "The Red Herring Log"
 * 
 * Verifies the agent found the real root cause (wrong input filename)
 * instead of just creating the output directory.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'red-herring-log',
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

// Check 1: Script runs without errors
check('script-runs-clean', () => {
  try {
    const output = execSync('node process.js', { 
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 
    });
    return { passed: true, detail: `Script ran cleanly: ${output.trim()}` };
  } catch (err) {
    return { passed: false, detail: `Script errored: ${err.stderr || err.message}` };
  }
});

// Check 2: Output file exists and contains data
check('output-has-data', () => {
  const outPath = path.join(envDir, 'output', 'results.json');
  if (!fs.existsSync(outPath)) {
    return { passed: false, detail: 'output/results.json does not exist' };
  }
  const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  return {
    passed: Array.isArray(data) && data.length >= 1,
    detail: Array.isArray(data) 
      ? `Output contains ${data.length} records` 
      : 'Output is not an array'
  };
});

// Check 3: Output contains correct product data (proves real CSV was read)
check('data-is-correct', () => {
  const outPath = path.join(envDir, 'output', 'results.json');
  if (!fs.existsSync(outPath)) {
    return { passed: false, detail: 'output/results.json does not exist' };
  }
  const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  const hasWidgetA = data.some(r => r.product === 'Widget A');
  const hasWidgetB = data.some(r => r.product === 'Widget B');
  return {
    passed: hasWidgetA && hasWidgetB,
    detail: hasWidgetA && hasWidgetB
      ? 'Output contains expected product data (Widget A, Widget B)'
      : `Missing products. Found: ${data.map(r => r.product).join(', ')}`
  };
});

// Check 4: The real CSV file still exists (agent shouldn't have deleted it)
check('source-csv-intact', () => {
  const csvPath = path.join(envDir, 'data', 'sales-2026.csv');
  return {
    passed: fs.existsSync(csvPath),
    detail: fs.existsSync(csvPath) 
      ? 'Source CSV file still exists' 
      : 'Source CSV file was deleted'
  };
});

// Check 5: process.js still uses config-driven input (not hardcoded)
check('not-hardcoded', () => {
  const src = fs.readFileSync(path.join(envDir, 'process.js'), 'utf-8');
  const usesConfig = src.includes('config.inputFile') || src.includes('config[');
  return {
    passed: usesConfig,
    detail: usesConfig
      ? 'process.js still uses config-driven input path'
      : 'process.js appears to have hardcoded the file path'
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed 
  ? 'Agent found the real root cause (input file mismatch) and fixed it correctly'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
