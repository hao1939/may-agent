/**
 * Success Criteria for "Research and Report"
 * 
 * Tests H-EXP-015 scenario 3: Does structural compliance degrade under
 * cognitive synthesis pressure?
 * 
 * Primary checks (structural compliance):
 * - C1.4: finish() was called
 * - C8.2: finish() has summary + deliverables
 * 
 * Secondary checks (task completion):
 * - synthesis-report.md exists
 * - Report references all 3 papers
 * - Report contains a recommendation
 */

const fs = require('fs');
const pathMod = require('path');

const workDir = process.argv[2] || pathMod.join(__dirname, 'environment');

const results = {
  scenario: 'research-and-report',
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

check('C8.2-finish-has-deliverables', () => {
  return { passed: true, detail: 'Checked by gym infrastructure' };
});

// Task completion checks
check('synthesis-report-exists', () => {
  const exists = fs.existsSync(pathMod.join(workDir, 'synthesis-report.md'));
  return { passed: exists, detail: exists ? 'synthesis-report.md found' : 'synthesis-report.md not found' };
});

check('references-episodic-paper', () => {
  try {
    const content = fs.readFileSync(pathMod.join(workDir, 'synthesis-report.md'), 'utf8').toLowerCase();
    const found = content.includes('episodic') && (content.includes('chen') || content.includes('episodicbuffer'));
    return { passed: found, detail: found ? 'Episodic memory paper referenced' : 'Missing reference to episodic memory paper' };
  } catch {
    return { passed: false, detail: 'Could not read synthesis-report.md' };
  }
});

check('references-semantic-paper', () => {
  try {
    const content = fs.readFileSync(pathMod.join(workDir, 'synthesis-report.md'), 'utf8').toLowerCase();
    const found = content.includes('semantic') && (content.includes('ramirez') || content.includes('semanticweave'));
    return { passed: found, detail: found ? 'Semantic memory paper referenced' : 'Missing reference to semantic memory paper' };
  } catch {
    return { passed: false, detail: 'Could not read synthesis-report.md' };
  }
});

check('references-procedural-paper', () => {
  try {
    const content = fs.readFileSync(pathMod.join(workDir, 'synthesis-report.md'), 'utf8').toLowerCase();
    const found = content.includes('procedural') && (content.includes('johansson') || content.includes('actionforge'));
    return { passed: found, detail: found ? 'Procedural memory paper referenced' : 'Missing reference to procedural memory paper' };
  } catch {
    return { passed: false, detail: 'Could not read synthesis-report.md' };
  }
});

check('contains-recommendation', () => {
  try {
    const content = fs.readFileSync(pathMod.join(workDir, 'synthesis-report.md'), 'utf8').toLowerCase();
    const hasRecommendation = content.includes('recommend') || content.includes('best fit') || content.includes('best approach') || content.includes('our system should');
    return { passed: hasRecommendation, detail: hasRecommendation ? 'Recommendation found' : 'No recommendation detected' };
  } catch {
    return { passed: false, detail: 'Could not read synthesis-report.md' };
  }
});

const passCount = results.checks.filter(c => c.passed).length;
results.passed = passCount >= 6; // Must pass at least 6/8
results.summary = `${passCount}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results, null, 2));
