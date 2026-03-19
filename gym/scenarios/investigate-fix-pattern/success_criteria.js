/**
 * Success Criteria for "investigate-fix-pattern"
 *
 * Tests both PRODUCT (correct output) and PROCESS (behavioral pattern):
 *
 * Product:
 *   1. All 6 tests pass (node test.js exits 0)
 *   2. server.js handles legacy profile.email format
 *   3. server.js handles null email
 *   4. server.js returns 404 for invalid IDs
 *
 * Process (Investigate-and-Fix skill compliance):
 *   P1: Agent read db.js BEFORE editing server.js (understand data before fixing)
 *   P2: Agent ran tests BEFORE making changes (reproduce first)
 *   P3: Agent read server.js BEFORE editing it (read before edit)
 *   P4: Agent ran tests AFTER making changes (verify fix)
 *   P5: Agent read back edited file(s) after changes (readback verification)
 *
 * Design: The bug requires reading db.js to understand legacy vs standard format.
 * An agent that only reads server.js will either miss the root cause or make a
 * brittle fix. The test.js file also hints at what's expected.
 *
 * Skill reference: agents/shared/skills/investigate-and-fix/SKILL.md
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'investigate-fix-pattern',
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
  // The fix should reference profile.email or profile?.email in actual code (not comments)
  // Strip both full-line comments AND inline comments (after //)
  const codeLines = server.split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))  // strip inline comments
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
  // Strip comments, keep only code
  const codeLines = server.split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .filter(l => l.trim().length > 0);
  const code = codeLines.join('\n');
  // Should have null/undefined handling for email in actual code
  // Accept: ??, ?., || 'default', || null, if(email), ternary (email ? ... : ...)
  const handlesNull = code.includes('??') || code.includes('?.') || 
    (code.includes('email') && (code.includes("|| '") || code.includes('|| "'))) ||
    code.includes('|| null') ||
    code.match(/if\s*\(.*email/) ||
    code.match(/email\w*\s*\?\s*/) ||  // ternary: emailVar ? ...
    code.match(/!\s*email/);             // negation: !email or !emailFormatted
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

// --- PROCESS CHECKS (from transcript) ---
// These check behavioral compliance with the investigate-and-fix pattern

// Check for transcript: argv[3] explicitly, or workDir/transcript.jsonl (gym runner convention)
const transcriptPath = process.argv[3] || path.join(envDir, 'transcript.jsonl');
let transcript = '';
if (transcriptPath && fs.existsSync(transcriptPath)) {
  transcript = fs.readFileSync(transcriptPath, 'utf-8');
}

// Parse transcript for tool calls
function getToolCalls(text) {
  const calls = [];
  // Match common transcript patterns for tool calls
  // Format 1: {"role":"assistant",...,"content":[...{"type":"toolCall","name":"read","arguments":{...}}...]}
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
      } catch (e) { /* skip unparseable lines */ }
    }
  } catch (e) { /* skip */ }
  return calls;
}

const toolCalls = getToolCalls(transcript);

if (toolCalls.length > 0) {
  // P1: Read db.js before editing server.js
  check('read-db-before-edit', 'process', () => {
    const firstEditIdx = toolCalls.findIndex(c => c.name === 'edit' || c.name === 'write');
    const readDbIdx = toolCalls.findIndex(c => 
      c.name === 'read' && c.args && c.args.path && c.args.path.includes('db')
    );
    const bashCatDb = toolCalls.findIndex(c =>
      c.name === 'bash' && c.args && c.args.command && c.args.command.includes('db')
    );
    const readDb = readDbIdx >= 0 ? readDbIdx : bashCatDb;
    const passed = readDb >= 0 && firstEditIdx >= 0 && readDb < firstEditIdx;
    return {
      passed,
      detail: passed ? 'Read db.js before first edit' : 'Did not read db.js before making changes — missed root cause investigation'
    };
  });

  // P2: Run tests before changes (reproduce)
  check('reproduce-first', 'process', () => {
    const firstEditIdx = toolCalls.findIndex(c => c.name === 'edit' || c.name === 'write');
    const testBeforeEdit = toolCalls.findIndex(c =>
      c.name === 'bash' && c.args && c.args.command && c.args.command.includes('test')
    );
    const passed = testBeforeEdit >= 0 && firstEditIdx >= 0 && testBeforeEdit < firstEditIdx;
    return {
      passed,
      detail: passed ? 'Ran tests before making changes (reproduce first)' : 'Did not run tests before editing — skipped reproduction step'
    };
  });

  // P3: Read server.js before editing it
  check('read-before-edit', 'process', () => {
    const firstEditIdx = toolCalls.findIndex(c => c.name === 'edit' || c.name === 'write');
    const readServer = toolCalls.findIndex(c =>
      c.name === 'read' && c.args && c.args.path && c.args.path.includes('server')
    );
    const bashCatServer = toolCalls.findIndex(c =>
      c.name === 'bash' && c.args && c.args.command && (c.args.command.includes('cat') && c.args.command.includes('server'))
    );
    const readIdx = readServer >= 0 ? readServer : bashCatServer;
    const passed = readIdx >= 0 && firstEditIdx >= 0 && readIdx < firstEditIdx;
    return {
      passed,
      detail: passed ? 'Read server.js before editing' : 'Edited server.js without reading it first'
    };
  });

  // P4: Run tests after changes (verify)
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

  // P5: Read back edited file after changes
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
      detail: passed ? 'Read back server.js after editing (readback verification)' : 'Did not read back edited file — skipped readback'
    };
  });
} else {
  // No transcript available — skip process checks
  check('transcript-available', 'process', () => ({
    passed: false,
    detail: 'No transcript provided — process checks skipped. Pass transcript path as argv[3].'
  }));
}

// --- SCORING ---
const productChecks = results.checks.filter(c => c.category === 'product');
const processChecks = results.checks.filter(c => c.category === 'process');

const productPassed = productChecks.filter(c => c.passed).length;
const processPassed = processChecks.filter(c => c.passed).length;
const totalPassed = productPassed + processPassed;
const totalChecks = productChecks.length + processChecks.length;

// Overall pass requires all product checks + at least 3/5 process checks
results.passed = productPassed === productChecks.length && processPassed >= 3;

results.summary = `Product: ${productPassed}/${productChecks.length}, ` +
  `Process: ${processPassed}/${processChecks.length}. ` +
  (results.passed ? 'PASS' : 'FAIL') +
  `. Investigate-and-fix skill ${results.passed ? 'demonstrated' : 'not demonstrated'}.`;

console.log(JSON.stringify(results, null, 2));
