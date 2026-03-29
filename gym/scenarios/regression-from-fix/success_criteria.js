/**
 * Regression-from-fix scenario scorer.
 * 
 * The bug: In billing.js, the discount lookup uses undefined variable `code`
 * instead of `discountCode`. The fix is simple: change `code` to `discountCode`.
 * 
 * What we check:
 * 1. Agent read billing.js before editing
 * 2. The discount bug is actually fixed
 * 3. Agent ran the test suite
 * 4. Tax-exempt functionality still works (no regression)
 * 5. The fix is minimal (didn't rewrite unrelated code)
 * 6. All tests pass
 * 
 * Usage: node success_criteria.js <workDir>
 */

const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || __dirname;

const results = {
  scenario: 'regression-from-fix',
  passed: false,
  checks: [],
  summary: ''
};

// Parse transcript to extract tool calls
function parseTranscript(dir) {
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return [];
  
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
  const toolCalls = [];
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Look for tool_call entries
      if (entry.role === 'assistant' && entry.content) {
        // Parse tool calls from assistant messages
        const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
        // Match tool call patterns
        const toolCallMatches = content.matchAll(/\[tool_call:\s*(\w+)\]\s*(\{[\s\S]*?\})/g);
        for (const match of toolCallMatches) {
          try {
            toolCalls.push({ name: match[1], arguments: JSON.parse(match[2]) });
          } catch {}
        }
      }
      // Also check for structured tool_calls
      if (entry.tool_calls) {
        for (const tc of entry.tool_calls) {
          toolCalls.push({ name: tc.function?.name || tc.name, arguments: tc.function?.arguments || tc.arguments });
        }
      }
      // Check tool_call role entries
      if (entry.role === 'tool_call' || entry.type === 'tool_call') {
        toolCalls.push({ name: entry.name || entry.function?.name, arguments: entry.arguments || entry.function?.arguments });
      }
    } catch {}
  }
  return toolCalls;
}

// Get tool results from transcript
function getToolResults(dir) {
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) return [];
  
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
  const results = [];
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'tool' || entry.role === 'tool_result' || entry.type === 'tool_result') {
        results.push(typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content));
      }
    } catch {}
  }
  return results;
}

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

const toolCalls = parseTranscript(workDir);
const toolResults = getToolResults(workDir);
const allOutput = toolResults.join('\n');

// Check 1: Agent read billing.js before editing
check('read-before-edit', () => {
  const readBilling = toolCalls.some(c => 
    c.name === 'read' && c.arguments?.path?.includes('billing.js')
  );
  return {
    passed: readBilling,
    detail: readBilling 
      ? 'Agent read billing.js before editing' 
      : 'Agent did not read billing.js before editing'
  };
});

// Check 2: Agent fixed the bug (changed `code` to `discountCode`)
check('discount-bug-fixed', () => {
  const editCalls = toolCalls.filter(c => 
    (c.name === 'edit' || c.name === 'write') && 
    c.arguments?.path?.includes('billing.js')
  );
  const fixApplied = editCalls.some(c => {
    const content = c.arguments?.newText || c.arguments?.content || '';
    return content.includes('DISCOUNT_CODES[discountCode]') || 
           content.includes('DISCOUNT_CODES[ discountCode ]');
  });
  return {
    passed: fixApplied,
    detail: fixApplied 
      ? 'Agent fixed the discount code variable reference' 
      : 'Agent did not fix the core bug (code → discountCode)'
  };
});

// Check 3: Agent ran the test suite
check('ran-tests', () => {
  const ranTests = toolCalls.some(c =>
    c.name === 'bash' && c.arguments?.command?.includes('test-billing')
  );
  return {
    passed: ranTests,
    detail: ranTests 
      ? 'Agent ran the test suite' 
      : 'Agent did not run the test suite'
  };
});

// Check 4: Tax-exempt function not broken
check('tax-exempt-preserved', () => {
  const editCalls = toolCalls.filter(c => 
    (c.name === 'edit' || c.name === 'write') && 
    c.arguments?.path?.includes('billing.js')
  );
  const taxExemptBroken = editCalls.some(c => {
    const content = c.arguments?.newText || c.arguments?.content || '';
    if (c.name === 'write' && content.includes('calculateTaxExemptTotal')) {
      return !content.includes('result.taxable') || !content.includes('tax: 0');
    }
    if (c.name === 'edit') {
      const oldText = c.arguments?.oldText || '';
      return oldText.includes('calculateTaxExemptTotal') || 
             oldText.includes('taxExempt');
    }
    return false;
  });
  return {
    passed: !taxExemptBroken,
    detail: taxExemptBroken 
      ? 'Agent broke or modified the tax-exempt function (regression!)' 
      : 'Tax-exempt function preserved correctly'
  };
});

// Check 5: Minimal fix
check('minimal-fix', () => {
  const editCalls = toolCalls.filter(c => 
    (c.name === 'edit' || c.name === 'write') && 
    c.arguments?.path?.includes('billing.js')
  );
  const usedMinimalEdit = editCalls.some(c => c.name === 'edit');
  const rewroteFile = editCalls.some(c => c.name === 'write');
  return {
    passed: usedMinimalEdit && !rewroteFile,
    detail: usedMinimalEdit && !rewroteFile
      ? 'Agent used surgical edit (not full rewrite)'
      : rewroteFile
        ? 'Agent rewrote the entire file instead of making a targeted edit'
        : 'Agent did not make any edits to billing.js'
  };
});

// Check 6: All tests pass
check('all-tests-pass', () => {
  const testOutput = allOutput;
  const allTestsPass = testOutput.includes('0 failed') || 
                       (testOutput.includes('passed') && !testOutput.includes('✗'));
  return {
    passed: allTestsPass,
    detail: allTestsPass 
      ? 'All tests passed after fix' 
      : 'Some tests still failing after fix'
  };
});

// Overall pass: all checks passed
results.passed = results.checks.every(c => c.passed);
results.summary = results.passed 
  ? 'All checks passed — bug fixed without regressions'
  : `${results.checks.filter(c => c.passed).length}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
