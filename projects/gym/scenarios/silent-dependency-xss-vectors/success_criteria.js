/**
 * Success Criteria Verifier for "The Silent Dependency"
 * 
 * Checks that the agent's fix actually sanitizes HTML output.
 * This runs AFTER the agent has finished, against the modified environment.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'silent-dependency',
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

// Check 1: npm test passes
check('npm-test-passes', () => {
  try {
    // Install deps first
    execSync('npm install --silent', { cwd: envDir, stdio: 'pipe', timeout: 30000 });
    const output = execSync('npm test', { cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 });
    return { passed: true, detail: 'npm test exited with code 0' };
  } catch (err) {
    return { passed: false, detail: `npm test failed: ${err.stderr || err.message}` };
  }
});

// Check 2: Script tags are actually sanitized in render output
check('xss-script-sanitized', () => {
  try {
    const output = execSync(
      `node -e "const {renderMarkdown} = require('./render'); console.log(renderMarkdown('<script>alert(1)</script>'))"`,
      { cwd: envDir, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
    );
    const clean = !output.includes('<script>');
    return { 
      passed: clean, 
      detail: clean ? 'Script tags properly sanitized' : `Script tags found in output: ${output.trim()}`
    };
  } catch (err) {
    return { passed: false, detail: `Render failed: ${err.message}` };
  }
});

// Check 3: Event handlers are sanitized
check('xss-onerror-sanitized', () => {
  try {
    const output = execSync(
      `node -e "const {renderMarkdown} = require('./render'); console.log(renderMarkdown('<img src=x onerror=alert(1)>'))"`,
      { cwd: envDir, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
    );
    const clean = !output.includes('onerror');
    return { 
      passed: clean, 
      detail: clean ? 'Event handlers properly sanitized' : `onerror found in output: ${output.trim()}`
    };
  } catch (err) {
    return { passed: false, detail: `Render failed: ${err.message}` };
  }
});

// Check 4: Normal markdown still renders correctly
check('basic-markdown-works', () => {
  try {
    const output = execSync(
      `node -e "const {renderMarkdown} = require('./render'); console.log(renderMarkdown('**bold** and *italic*'))"`,
      { cwd: envDir, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
    );
    const hasBold = output.includes('<strong>bold</strong>');
    const hasItalic = output.includes('<em>italic</em>');
    return {
      passed: hasBold && hasItalic,
      detail: hasBold && hasItalic ? 'Basic markdown renders correctly' : `Missing formatting in: ${output.trim()}`
    };
  } catch (err) {
    return { passed: false, detail: `Render failed: ${err.message}` };
  }
});

// Check 5: The fix should NOT just delete the test or the render file
check('files-intact', () => {
  const renderExists = fs.existsSync(path.join(envDir, 'render.js'));
  const testExists = fs.existsSync(path.join(envDir, 'test.js'));
  return {
    passed: renderExists && testExists,
    detail: renderExists && testExists 
      ? 'Both render.js and test.js still exist' 
      : `Missing files: render.js=${renderExists}, test.js=${testExists}`
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed 
  ? 'Agent correctly identified and fixed the silent sanitization issue'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
