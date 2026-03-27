/**
 * Success Criteria for "investigate-fix-pattern-workflow"
 *
 * Workflow-enforced variant of investigate-fix-pattern.
 * Two-phase workflow splits investigation from implementation.
 *
 * Product checks (same as non-workflow):
 *   1. All 6 tests pass (node test.js exits 0)
 *   2. server.js handles legacy profile.email format
 *   3. server.js handles null email
 *   4. server.js returns 404 for invalid IDs
 *
 * Process checks (workflow-specific):
 *   P1: analysis.md exists and contains root cause description
 *   P2: analysis.md mentions legacy/profile email format
 *   P3: analysis.md mentions null email issue
 *   P4: Tests were run in Phase 2 (verification after fix)
 *   P5: server.js was read back after editing (readback verification)
 *
 * The workflow enforcement mechanically prevents editing in Phase 1.
 * This tests whether separating investigation from implementation
 * leads to better outcomes.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'investigate-fix-pattern-workflow',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, category, fn) {
  try {
    const result = fn();
    results.checks.push({
      name,
      passed: result.passed,
      detail: result.detail,
      category: category
    });
    return result.passed;
  } catch (e) {
    results.checks.push({
      name,
      passed: false,
      detail: `Error: ${e.message}`,
      category: category
    });
    return false;
  }
}

// --- PRODUCT CHECKS ---

check('all-tests-pass', 'product', () => {
  try {
    const output = execSync(`node test.js`, {
      encoding: 'utf-8',
      timeout: 10000,
      cwd: envDir
    });
    const passMatch = output.match(/(\d+) passed, (\d+) failed/);
    if (!passMatch) return { passed: false, detail: 'Could not parse test output' };
    const passed = parseInt(passMatch[1]);
    const failed = parseInt(passMatch[2]);
    return {
      passed: failed === 0 && passed === 6,
      detail: `${passed} passed, ${failed} failed`
    };
  } catch (e) {
    return { passed: false, detail: `Tests crashed: ${e.message.slice(0, 200)}` };
  }
});

check('handles-legacy-email', 'product', () => {
  const server = fs.readFileSync(path.join(envDir, 'server.js'), 'utf-8');
  const codeLines = server.split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .filter(l => l.trim().length > 0);
  const code = codeLines.join('\n');
  const handlesProfile = code.includes('profile.email') || code.includes('profile?.email') ||
    code.includes('.profile') || code.includes('user.profile');
  return {
    passed: handlesProfile,
    detail: handlesProfile ? 'server.js handles profile.email format in code' : 'No profile.email handling in server.js code (comments dont count)'
  };
});

check('handles-null-email', 'product', () => {
  const server = fs.readFileSync(path.join(envDir, 'server.js'), 'utf-8');
  const codeLines = server.split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .filter(l => l.trim().length > 0);
  const code = codeLines.join('\n');
  const handlesNull = code.includes('??') || code.includes('?.') || 
    (code.includes('email') && (code.includes("|| '") || code.includes('|| "'))) ||
    code.includes('|| null') ||
    code.match(/if\s*\(.*email/) ||
    code.match(/email\w*\s*\?\s*/) ||
    code.match(/!\s*email/);
  return {
    passed: !!handlesNull,
    detail: handlesNull ? 'server.js has null email handling in code' : 'No null email handling found in code'
  };
});

check('returns-404', 'product', () => {
  const server = fs.readFileSync(path.join(envDir, 'server.js'), 'utf-8');
  const has404 = server.includes('404');
  return {
    passed: has404,
    detail: has404 ? 'server.js returns 404' : 'No 404 status code found'
  };
});

// --- PROCESS CHECKS (workflow-specific) ---

// P1: analysis.md exists and is non-trivial
check('analysis-exists', 'process', () => {
  const analysisPath = path.join(envDir, 'analysis.md');
  if (!fs.existsSync(analysisPath)) {
    return { passed: false, detail: 'analysis.md not created — Phase 1 did not write analysis' };
  }
  const content = fs.readFileSync(analysisPath, 'utf-8');
  const passed = content.length > 100;
  return {
    passed,
    detail: passed 
      ? `analysis.md exists (${content.length} chars)` 
      : `analysis.md exists but too short (${content.length} chars) — seems incomplete`
  };
});

// P2: analysis.md identifies the legacy profile.email issue
check('analysis-identifies-legacy', 'process', () => {
  const analysisPath = path.join(envDir, 'analysis.md');
  if (!fs.existsSync(analysisPath)) {
    return { passed: false, detail: 'analysis.md not found' };
  }
  const content = fs.readFileSync(analysisPath, 'utf-8').toLowerCase();
  const mentions = content.includes('profile') || content.includes('legacy');
  return {
    passed: mentions,
    detail: mentions 
      ? 'Analysis identifies legacy profile.email format' 
      : 'Analysis does not mention legacy/profile format — incomplete investigation'
  };
});

// P3: analysis.md identifies the null email issue
check('analysis-identifies-null', 'process', () => {
  const analysisPath = path.join(envDir, 'analysis.md');
  if (!fs.existsSync(analysisPath)) {
    return { passed: false, detail: 'analysis.md not found' };
  }
  const content = fs.readFileSync(analysisPath, 'utf-8').toLowerCase();
  const mentions = content.includes('null') || content.includes('undefined') || content.includes('missing email');
  return {
    passed: mentions,
    detail: mentions 
      ? 'Analysis identifies null email issue' 
      : 'Analysis does not mention null/undefined email — incomplete investigation'
  };
});

// P4 and P5 use transcript if available
const transcriptPath = process.argv[3] || path.join(envDir, 'transcript.jsonl');
let transcript = '';
if (transcriptPath && fs.existsSync(transcriptPath)) {
  transcript = fs.readFileSync(transcriptPath, 'utf-8');
}

function getToolCalls(text) {
  const calls = [];
  try {
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'toolCall') {
              const args = typeof block.arguments === 'string' ? JSON.parse(block.arguments) : (block.arguments || {});
              calls.push({ name: block.name, args });
            }
          }
        }
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* skip */ }
  return calls;
}

const toolCalls = getToolCalls(transcript);

if (toolCalls.length > 0) {
  // P4: Tests run after fix
  check('verify-after-fix', 'process', () => {
    const lastEditIdx = (() => {
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        if (toolCalls[i].name === 'edit' || toolCalls[i].name === 'write') return i;
      }
      return -1;
    })();
    const testAfterEdit = toolCalls.findIndex((c, idx) =>
      idx > lastEditIdx && c.name === 'bash' && c.args && c.args.command && c.args.command.includes('test')
    );
    const passed = testAfterEdit >= 0;
    return {
      passed,
      detail: passed ? 'Ran tests after making changes (verification)' : 'Did not run tests after editing — skipped verification'
    };
  });

  // P5: Read back edited file
  check('readback-verification', 'process', () => {
    const lastEditIdx = (() => {
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        if (toolCalls[i].name === 'edit' || toolCalls[i].name === 'write') return i;
      }
      return -1;
    })();
    const readAfterEdit = toolCalls.findIndex((c, idx) =>
      idx > lastEditIdx && c.name === 'read' && c.args && c.args.path && c.args.path.includes('server')
    );
    const catAfterEdit = toolCalls.findIndex((c, idx) =>
      idx > lastEditIdx && c.name === 'bash' && c.args && c.args.command && 
      (c.args.command.includes('cat') && c.args.command.includes('server'))
    );
    const passed = readAfterEdit >= 0 || catAfterEdit >= 0;
    return {
      passed,
      detail: passed ? 'Read back server.js after editing' : 'Did not read back edited file'
    };
  });
} else {
  // No transcript — accept analysis-based checks as sufficient
  check('transcript-available', 'process', () => ({
    passed: false,
    detail: 'No transcript provided — behavioral checks (P4, P5) skipped'
  }));
}

// --- SCORING ---
const productChecks = results.checks.filter(c => c.category === 'product');
const processChecks = results.checks.filter(c => c.category === 'process');

const productPassed = productChecks.filter(c => c.passed).length;
const processPassed = processChecks.filter(c => c.passed).length;
const totalChecks = productChecks.length + processChecks.length;

// Overall pass: all product checks + at least 3/5 process checks
results.passed = productPassed === productChecks.length && processPassed >= 3;

results.summary = `Product: ${productPassed}/${productChecks.length}, ` +
  `Process: ${processPassed}/${processChecks.length}. ` +
  (results.passed ? 'PASS' : 'FAIL') +
  `. Workflow investigation ${results.passed ? 'demonstrated' : 'not demonstrated'}.`;

console.log(JSON.stringify(results, null, 2));
