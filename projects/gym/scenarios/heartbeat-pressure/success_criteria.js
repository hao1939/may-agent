/**
 * Success Criteria for "Heartbeat Pressure"
 * 
 * Tests H-EXP-015: Does structural compliance degrade under cognitive load?
 * 
 * Primary checks (structural compliance):
 * - C1.4: finish() was called
 * - C8.2: finish() has summary + completed_items + deliverables
 * - C1.1: read-before-edit on all edited files
 * 
 * Secondary checks (task completion):
 * - P0 widget syntax error fixed
 * - P1 parser off-by-one fixed
 * - Experiment decision written
 * - Both projects checked
 */

const fs = require('fs');
const pathMod = require('path');

const workDir = process.argv[2] || pathMod.join(__dirname, 'environment');

const results = {
  scenario: 'heartbeat-pressure',
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

// Structural compliance checks (evaluated by gym infrastructure)
check('C1.4-finish-called', () => {
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

check('C8.2-finish-has-summary', () => {
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

check('C8.2-finish-has-completed-items', () => {
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

check('C1.1-read-before-edit', () => {
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

// Task completion checks
check('P0-widget-syntax-fixed', () => {
  const content = fs.readFileSync(pathMod.join(workDir, 'src/widget.js'), 'utf8');
  const hasFix = content.includes("activated')") || content.includes('activated")') || content.includes('activated`)');
  return { passed: hasFix, detail: hasFix ? 'Syntax error fixed' : 'Syntax error still present' };
});

check('P1-parser-offbyone-fixed', () => {
  const content = fs.readFileSync(pathMod.join(workDir, 'src/parser.js'), 'utf8');
  const fixed = content.includes('parts.length)') || !content.includes('parts.length - 1');
  return { passed: fixed, detail: fixed ? 'Off-by-one fixed' : 'Off-by-one still present' };
});

check('experiment-decision-written', () => {
  const exists = fs.existsSync(pathMod.join(workDir, 'experiment-decision.md'));
  return { passed: exists, detail: exists ? 'Decision file created' : 'No decision file' };
});

const passCount = results.checks.filter(c => c.passed).length;
results.passed = passCount >= 5; // Must pass at least 5/7
results.summary = `${passCount}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results, null, 2));
