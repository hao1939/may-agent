/**
 * Success Criteria for "tool-confusion"
 *
 * Tests both PRODUCT (correct fix) and PROCESS (tool selection):
 *
 * Product:
 *   P1. server.js parses without syntax errors
 *   P2. The missing comma on the comment object literal is fixed
 *
 * Process (Tool Selection):
 *   T1. Agent used bash with grep/node to locate the error (not reading 200 lines with `read`)
 *   T2. Agent used `edit` (not `write`) to fix a single-line issue
 *   T3. Agent verified the fix with a syntax check (node -c, node -e, etc.)
 *
 * Trap: File is ~200 lines. Line 142 has a missing comma in an object literal.
 *       A confused agent reads the whole file with `read`, then rewrites with `write`.
 *       An efficient agent uses `bash node -c` to locate the error, `edit` to fix, `bash node -c` to verify.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'tool-confusion',
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
      category
    });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Product Checks ─────────────────────────────────────────────────────

check('P1: syntax-valid', 'product', () => {
  const serverPath = path.join(envDir, 'server.js');
  if (!fs.existsSync(serverPath)) {
    return { passed: false, detail: 'server.js does not exist' };
  }
  try {
    execSync(`node -c "${serverPath}"`, { stdio: 'pipe' });
    return { passed: true, detail: 'server.js parses without syntax errors' };
  } catch (e) {
    return { passed: false, detail: `server.js has syntax errors: ${e.stderr ? e.stderr.toString().slice(0, 200) : e.message}` };
  }
});

check('P2: comma-fixed', 'product', () => {
  const serverPath = path.join(envDir, 'server.js');
  if (!fs.existsSync(serverPath)) {
    return { passed: false, detail: 'server.js does not exist' };
  }
  const content = fs.readFileSync(serverPath, 'utf-8');
  // The fix: line with "authorId: authorId || null" needs trailing comma before "createdAt"
  // Check that the object literal in the newComment block has proper commas
  const commentBlock = content.match(/const newComment\s*=\s*\{[^}]+\}/s);
  if (!commentBlock) {
    return { passed: false, detail: 'Could not find newComment object literal' };
  }
  // Check no syntax error in that region
  const lines = commentBlock[0].split('\n');
  const authorLine = lines.find(l => l.includes('authorId') && l.includes('null'));
  if (authorLine && authorLine.trim().endsWith(',')) {
    return { passed: true, detail: 'Missing comma after authorId line is fixed' };
  }
  // Also accept if the whole file just parses (they might have reformatted)
  try {
    execSync(`node -c "${path.join(envDir, 'server.js')}"`, { stdio: 'pipe' });
    return { passed: true, detail: 'File parses correctly (comma issue resolved)' };
  } catch {
    return { passed: false, detail: 'authorId line still missing trailing comma' };
  }
});

// ── Process Checks (Tool Selection) ────────────────────────────────────

check('T1: efficient-error-location', 'process', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  const toolCalls = [];
  for (const entry of entries) {
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === 'toolCall' || part.type === 'tool_use') {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input :
                       (typeof part.arguments === 'string' ? (() => { try { return JSON.parse(part.arguments); } catch { return {}; } })() : {});
          toolCalls.push({ name: part.name || part.toolName || '', args });
        }
      }
    }
  }

  // Check: did agent use bash with node -c or grep to locate the error?
  const bashLocate = toolCalls.filter(tc =>
    tc.name === 'bash' && typeof tc.args.command === 'string' && (
      tc.args.command.includes('node -c') ||
      tc.args.command.includes('node -e') ||
      tc.args.command.includes('grep') ||
      tc.args.command.includes('npx') ||
      tc.args.command.includes('jshint') ||
      tc.args.command.includes('eslint')
    )
  );

  if (bashLocate.length > 0) {
    return { passed: true, detail: `Agent used bash for error location: ${bashLocate[0].args.command.slice(0, 60)}` };
  }

  // If agent read the file with `read` tool first, that's acceptable but less efficient
  // We'll pass this check if they used bash at any point for syntax checking
  const anyBashSyntax = toolCalls.some(tc =>
    tc.name === 'bash' && typeof tc.args.command === 'string' &&
    tc.args.command.includes('server.js')
  );
  if (anyBashSyntax) {
    return { passed: true, detail: 'Agent used bash commands related to server.js' };
  }

  return { passed: false, detail: 'Agent did not use bash for efficient error location (used only read for a 200-line file)' };
});

check('T2: surgical-edit', 'process', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  const toolCalls = [];
  for (const entry of entries) {
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === 'toolCall' || part.type === 'tool_use') {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input :
                       (typeof part.arguments === 'string' ? (() => { try { return JSON.parse(part.arguments); } catch { return {}; } })() : {});
          toolCalls.push({ name: part.name || part.toolName || '', args });
        }
      }
    }
  }

  // Check: agent used `edit` not `write` for the fix
  const edits = toolCalls.filter(tc =>
    tc.name === 'edit' && typeof tc.args.path === 'string' && tc.args.path.includes('server.js')
  );
  const writes = toolCalls.filter(tc =>
    tc.name === 'write' && typeof tc.args.path === 'string' && tc.args.path.includes('server.js')
  );

  if (edits.length > 0 && writes.length === 0) {
    return { passed: true, detail: 'Agent used edit (not write) for surgical fix' };
  }
  if (writes.length > 0) {
    return { passed: false, detail: 'Agent used write to rewrite the entire file instead of edit for a one-line fix' };
  }
  // Also accept bash sed as surgical
  const bashSed = toolCalls.filter(tc =>
    tc.name === 'bash' && typeof tc.args.command === 'string' &&
    (tc.args.command.includes('sed') && tc.args.command.includes('server.js'))
  );
  if (bashSed.length > 0) {
    return { passed: true, detail: 'Agent used bash sed for surgical fix' };
  }
  return { passed: false, detail: 'No edit or write to server.js found' };
});

check('T3: syntax-verification', 'process', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  const toolCalls = [];
  for (const entry of entries) {
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === 'toolCall' || part.type === 'tool_use') {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input :
                       (typeof part.arguments === 'string' ? (() => { try { return JSON.parse(part.arguments); } catch { return {}; } })() : {});
          toolCalls.push({ name: part.name || part.toolName || '', args });
        }
      }
    }
  }

  // Find edits/writes to server.js
  const modifications = toolCalls.filter(tc =>
    (tc.name === 'edit' || tc.name === 'write' || (tc.name === 'bash' && typeof tc.args.command === 'string' && tc.args.command.includes('sed'))) &&
    ((tc.args.path && tc.args.path.includes('server.js')) || (tc.args.command && tc.args.command.includes('server.js')))
  );

  if (modifications.length === 0) {
    return { passed: false, detail: 'No modification to server.js found' };
  }

  // Check for verification AFTER last modification
  const lastModIdx = toolCalls.indexOf(modifications[modifications.length - 1]);
  const verifyCalls = toolCalls.slice(lastModIdx + 1).filter(tc =>
    tc.name === 'bash' && typeof tc.args.command === 'string' && (
      tc.args.command.includes('node -c') ||
      tc.args.command.includes('node -e') ||
      (tc.args.command.includes('node') && tc.args.command.includes('server.js'))
    )
  );

  // Also accept read-after-write
  const readAfter = toolCalls.slice(lastModIdx + 1).filter(tc =>
    tc.name === 'read' && typeof tc.args.path === 'string' && tc.args.path.includes('server.js')
  );

  if (verifyCalls.length > 0) {
    return { passed: true, detail: 'Agent verified syntax after fix' };
  }
  if (readAfter.length > 0) {
    return { passed: true, detail: 'Agent read file back after fix (visual verification)' };
  }
  return { passed: false, detail: 'Agent did not verify the fix after editing' };
});

// ── Summary ────────────────────────────────────────────────────────────

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
const productChecks = allChecks.filter(c => c.category === 'product');
const processChecks = allChecks.filter(c => c.category === 'process');
const productPass = productChecks.filter(c => c.passed).length;
const processPass = processChecks.filter(c => c.passed).length;

results.passed = passCount === allChecks.length;
results.summary = results.passed
  ? `All checks passed — syntax fixed, tools used efficiently (${processPass}/${processChecks.length} process)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, process: ${processPass}/${processChecks.length})`;

console.log(JSON.stringify(results, null, 2));
