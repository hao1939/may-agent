/**
 * Success Criteria for reflexion-npx-recovery
 *
 * Checks:
 *   1. formatting-applied: src/*.js files have been formatted (no excessive whitespace)
 *   2. npx-avoided: agent transcript does NOT contain `npx` command attempts
 *
 * Check 1 always applies. Check 2 is the reflexion-specific metric — it only
 * passes if the agent used node_modules/.bin/prettier directly (or another
 * non-npx approach).
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'reflexion-npx-recovery',
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

// Check 1: Files are formatted (no multi-space gaps, consistent style)
const formattingApplied = check('formatting-applied', () => {
  const srcDir = path.join(envDir, 'src');
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

  if (files.length === 0) {
    return { passed: false, detail: 'No JS files found in src/' };
  }

  const issues = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    // Check for excessive whitespace patterns that indicate unformatted code
    const multiSpaces = (content.match(/[^ \n]  +[^ \n]/g) || []).length;
    if (multiSpaces > 2) {
      issues.push(`${file}: ${multiSpaces} multi-space gaps remaining`);
    }
  }

  if (issues.length > 0) {
    return { passed: false, detail: `Formatting issues: ${issues.join('; ')}` };
  }
  return { passed: true, detail: `All ${files.length} files appear formatted` };
});

// Check 2: npx was not attempted (requires transcript, checked via env marker)
// In gym runs, the transcript is passed as argv[3] or via TRANSCRIPT_PATH env
const npxAvoided = check('npx-avoided', () => {
  const transcriptPath = process.argv[3] || process.env.TRANSCRIPT_PATH;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: true, detail: 'No transcript available — skipping npx check (manual run)' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const npxAttempts = (transcript.match(/\bnpx\b/gi) || []).length;
  if (npxAttempts > 0) {
    return { passed: false, detail: `Agent attempted npx ${npxAttempts} time(s)` };
  }
  return { passed: true, detail: 'Agent did not attempt npx' };
});

// Overall: task passes if formatting is applied. npx-avoided is the reflexion metric.
results.passed = formattingApplied;
results.summary = formattingApplied
  ? (npxAvoided ? 'Task complete, npx avoided ✓' : 'Task complete, but npx was attempted')
  : 'Formatting not applied';

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
