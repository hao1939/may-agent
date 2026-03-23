/**
 * Success Criteria for "path-discovery"
 *
 * Tests both PRODUCT (correct code) and PROCESS (path discovery behavior):
 *
 * Product:
 *   P1. The utility module still exports formatDate (no regression)
 *   P2. The utility module now exports formatCurrency
 *   P3. formatCurrency produces correctly formatted output
 *
 * Process (Path Discovery):
 *   D1. Agent explored directory structure (ls, find, tree) before/after path failures
 *   D2. Agent did NOT try to read/edit a non-existent path without recovering
 *   D3. Agent found the correct file (lib/helpers/formatting/date-utils.js)
 *
 * Trap: The utility module is at lib/helpers/formatting/date-utils.js, NOT lib/utils.js.
 *       An agent that assumes paths will fail; one that explores will succeed.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'path-discovery',
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

check('P1: formatDate-preserved', 'product', () => {
  const utilPath = path.join(envDir, 'lib/helpers/formatting/date-utils.js');
  if (!fs.existsSync(utilPath)) {
    return { passed: false, detail: 'date-utils.js does not exist (was it moved or deleted?)' };
  }
  const content = fs.readFileSync(utilPath, 'utf-8');
  if (content.includes('formatDate') && content.includes('module.exports')) {
    // Check it still exports formatDate
    if (content.includes('formatDate')) {
      return { passed: true, detail: 'formatDate still present in exports' };
    }
  }
  return { passed: false, detail: 'formatDate function missing or not exported' };
});

check('P2: formatCurrency-exists', 'product', () => {
  const utilPath = path.join(envDir, 'lib/helpers/formatting/date-utils.js');
  if (!fs.existsSync(utilPath)) {
    return { passed: false, detail: 'date-utils.js does not exist' };
  }
  const content = fs.readFileSync(utilPath, 'utf-8');
  if (content.includes('formatCurrency') && content.includes('module.exports')) {
    // Check it's in exports
    const exportsSection = content.slice(content.lastIndexOf('module.exports'));
    if (exportsSection.includes('formatCurrency')) {
      return { passed: true, detail: 'formatCurrency is defined and exported' };
    }
  }
  return { passed: false, detail: 'formatCurrency not found or not exported' };
});

check('P3: formatCurrency-works', 'product', () => {
  const utilPath = path.join(envDir, 'lib/helpers/formatting/date-utils.js');
  if (!fs.existsSync(utilPath)) {
    return { passed: false, detail: 'date-utils.js does not exist' };
  }
  try {
    // Clear require cache
    delete require.cache[require.resolve(utilPath)];
    const mod = require(utilPath);
    if (typeof mod.formatCurrency !== 'function') {
      return { passed: false, detail: 'formatCurrency is not a function' };
    }
    const result = mod.formatCurrency(1234.56, 'USD');
    if (typeof result !== 'string') {
      return { passed: false, detail: `formatCurrency returned ${typeof result}, expected string` };
    }
    // Should contain the number in some formatted form
    if (result.includes('1,234.56') || result.includes('1234.56') || result.includes('$')) {
      return { passed: true, detail: `formatCurrency(1234.56, 'USD') = "${result}"` };
    }
    return { passed: false, detail: `formatCurrency output doesn't look right: "${result}"` };
  } catch (e) {
    return { passed: false, detail: `Error loading module: ${e.message}` };
  }
});

// ── Process Checks (Path Discovery) ────────────────────────────────────

check('D1: directory-exploration', 'process', () => {
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

  // Check for directory exploration commands
  const explorations = toolCalls.filter(tc =>
    (tc.name === 'bash' && typeof tc.args.command === 'string' && (
      tc.args.command.includes('ls') ||
      tc.args.command.includes('find') ||
      tc.args.command.includes('tree') ||
      tc.args.command.includes('grep -r') ||
      tc.args.command.includes('grep -rl')
    ))
  );

  if (explorations.length > 0) {
    return { passed: true, detail: `Agent explored directory structure (${explorations.length} exploration commands)` };
  }
  return { passed: false, detail: 'Agent did not explore directory structure — may have assumed paths' };
});

check('D2: graceful-recovery', 'process', () => {
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
  const toolResults = [];
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
    if (entry.role === 'tool') {
      const content = typeof entry.content === 'string' ? entry.content :
                      Array.isArray(entry.content) ? entry.content.map(c => c.text || '').join('') : '';
      toolResults.push(content);
    }
  }

  // Check if agent tried a wrong path and then recovered
  const pathErrors = toolResults.filter(r =>
    r.includes('ENOENT') || r.includes('No such file') || r.includes('does not exist')
  );

  // If no path errors at all, agent explored properly first — that's good
  if (pathErrors.length === 0) {
    return { passed: true, detail: 'Agent found correct path without hitting ENOENT errors' };
  }

  // If there were errors, check that agent recovered (did exploration after the error)
  // We'll be lenient: if the task ultimately succeeded, recovery happened
  const utilPath = path.join(envDir, 'lib/helpers/formatting/date-utils.js');
  if (fs.existsSync(utilPath)) {
    const content = fs.readFileSync(utilPath, 'utf-8');
    if (content.includes('formatCurrency')) {
      return { passed: true, detail: `Agent recovered from ${pathErrors.length} path error(s) and found the correct file` };
    }
  }

  return { passed: false, detail: `Agent hit ${pathErrors.length} path error(s) but did not recover to find the correct file` };
});

check('D3: correct-file-found', 'process', () => {
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

  // Check agent actually interacted with the correct file
  const correctFileAccess = toolCalls.some(tc =>
    (tc.name === 'read' || tc.name === 'edit' || tc.name === 'write') &&
    typeof tc.args.path === 'string' &&
    tc.args.path.includes('date-utils.js')
  );

  if (correctFileAccess) {
    return { passed: true, detail: 'Agent found and accessed lib/helpers/formatting/date-utils.js' };
  }
  return { passed: false, detail: 'Agent never accessed the correct file (date-utils.js)' };
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
  ? `All checks passed — code correct, paths discovered gracefully (${processPass}/${processChecks.length} process)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, process: ${processPass}/${processChecks.length})`;

console.log(JSON.stringify(results, null, 2));
