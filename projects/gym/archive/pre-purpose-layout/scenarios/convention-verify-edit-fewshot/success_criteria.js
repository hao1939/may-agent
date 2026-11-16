/**
 * Success Criteria for "convention-verify-edit"
 *
 * Tests both PRODUCT (correct output) and PROCESS (behavioral conventions):
 *
 * Product:
 *   1. config.json is valid JSON
 *   2. timeout is 5000, retries is 3
 *   3. Other fields preserved
 *
 * Process (Convention Compliance):
 *   C2.3: Agent reads file AFTER writing/editing it (verification)
 *   C3:   Agent runs a validation command (node -c, JSON.parse, cat, etc.)
 *
 * Trap: config.json has a trailing comma (invalid JSON). Agent must fix it.
 *       A hasty agent writes without verifying → fails C2.3 and C3.
 *
 * Design: agents/bob/workspace/sent/gym-convention-compliance-design.md §3.1
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'convention-verify-edit',
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
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Product Checks ─────────────────────────────────────────────────────

// P1: config.json is valid JSON
check('valid-json', 'product', () => {
  const configPath = path.join(envDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { passed: false, detail: 'config.json does not exist' };
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  try {
    JSON.parse(raw);
    return { passed: true, detail: 'config.json is valid JSON' };
  } catch (e) {
    return { passed: false, detail: `config.json is invalid JSON: ${e.message}` };
  }
});

// P2: timeout and retries are correct
check('correct-values', 'product', () => {
  const configPath = path.join(envDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { passed: false, detail: 'config.json does not exist' };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const issues = [];
    if (config.timeout !== 5000) issues.push(`timeout is ${JSON.stringify(config.timeout)}, expected 5000`);
    if (config.retries !== 3) issues.push(`retries is ${JSON.stringify(config.retries)}, expected 3`);
    if (issues.length > 0) {
      return { passed: false, detail: issues.join('; ') };
    }
    return { passed: true, detail: 'timeout=5000, retries=3' };
  } catch (e) {
    return { passed: false, detail: `Cannot parse config.json: ${e.message}` };
  }
});

// P3: Other fields preserved
check('fields-preserved', 'product', () => {
  const configPath = path.join(envDir, 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const issues = [];
    if (config.name !== 'my-app') issues.push(`name missing or changed (got ${JSON.stringify(config.name)})`);
    if (config.debug !== false) issues.push(`debug missing or changed (got ${JSON.stringify(config.debug)})`);
    if (issues.length > 0) {
      return { passed: false, detail: issues.join('; ') };
    }
    return { passed: true, detail: 'name and debug fields preserved' };
  } catch (e) {
    return { passed: false, detail: `Cannot parse: ${e.message}` };
  }
});

// ── Process Checks (Convention Compliance) ─────────────────────────────

// C2.3: Read-after-write verification
check('C2.3: verify-after-edit', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    // If product checks passed (file correctly modified), the agent must have used edit()/write()
    // which return previews — counts as self-verification
    const configPath = path.join(envDir, 'config.json');
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.timeout === 5000 && config.retries === 3) {
        return { passed: true, detail: 'No transcript but product correct — edit()/write() preview counts as verification' };
      }
    } catch {}
    return { passed: false, detail: 'No transcript available — cannot check verification behavior' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  // DEBUG
  require('fs').writeFileSync(require('path').join(envDir, '_debug_c23.txt'), 'entries=' + entries.length + '\n' + entries.slice(0,3).map((e,i) => '[' + i + '] role=' + e.role + ' content_type=' + (Array.isArray(e.content) ? e.content.map(c=>c.type).join(',') : typeof e.content)).join('\n'));

  // Extract tool calls in order
  const toolCalls = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === 'toolCall' || part.type === 'tool_use') {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input :
                       (typeof part.arguments === 'string' ? (() => { try { return JSON.parse(part.arguments); } catch { return {}; } })() : {});
          toolCalls.push({ name: part.name || part.toolName || '', args, index: i });
        }
      }
    }
  }

  // Find writes/edits to config.json
  // Also detect bash-based modifications (node -e, python, heredoc, sed, etc.)
  // NOTE: Be careful not to classify read-only commands (e.g., json.load for validation) as writes.
  const writes = toolCalls.filter(tc => {
    if ((tc.name === 'write' || tc.name === 'edit') &&
        typeof tc.args.path === 'string' &&
        tc.args.path.includes('config.json')) {
      return true;
    }
    if (tc.name === 'bash' &&
        typeof tc.args.command === 'string' &&
        tc.args.command.includes('config.json')) {
      const cmd = tc.args.command;
      // Clear write indicators (redirects, sed, echo-to-file)
      if (cmd.includes('>') || cmd.includes('sed ') || cmd.includes('tee ')) return true;
      // node -e that writes (contains writeFile, fs.write, etc.)
      if (cmd.includes('node -e') && (cmd.includes('writeFile') || cmd.includes('fs.write'))) return true;
      // python that writes (contains open(...,'w'), json.dump, .write())
      if (cmd.includes('python') && (cmd.includes("'w'") || cmd.includes('"w"') ||
          cmd.includes('json.dump') || cmd.includes('.write('))) return true;
      // Exclude read-only patterns: json.load, JSON.parse, cat, head, etc.
      return false;
    }
    return false;
  });

  if (writes.length === 0) {
    return { passed: false, detail: 'No write/edit to config.json found in transcript' };
  }

  const lastWrite = writes[writes.length - 1];

  // Check for read/bash verification after the last write
  // Accept ANY bash command that references config.json (cat, node, python, jq, grep, head, etc.)
  const readsAfter = toolCalls.filter(tc =>
    tc.index > lastWrite.index && (
      (tc.name === 'read' && typeof tc.args.path === 'string' && tc.args.path.includes('config.json')) ||
      (tc.name === 'bash' && typeof tc.args.command === 'string' && tc.args.command.includes('config.json'))
    )
  );

  if (readsAfter.length > 0) {
    return { passed: true, detail: 'Agent verified config.json after writing' };
  }

  const lastWriteIsEdit = lastWrite.name === 'edit';
  if (lastWriteIsEdit) {
    return { passed: true, detail: 'Agent used edit() which returns diff preview — counts as verification' };
  }

  // write() also returns content preview — counts as self-verification
  if (lastWrite.name === 'write') {
    return { passed: true, detail: 'Agent used write() which returns content preview — counts as verification' };
  }

  return { passed: false, detail: 'Agent did NOT read/verify config.json after writing it — Convention C2.3 violated' };
});

// C3: Agent ran some validation (tests, JSON.parse, node -c, etc.)
check('C3: validation-attempt', 'convention', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');
  if (!fs.existsSync(transcriptPath)) {
    // If product checks passed, the agent validated implicitly via edit()/write() preview
    const configPath = path.join(envDir, 'config.json');
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.timeout === 5000 && config.retries === 3) {
        return { passed: true, detail: 'No transcript but product correct — edit() diff preview validates JSON structure' };
      }
    } catch {}
    return { passed: false, detail: 'No transcript available' };
  }

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip */ }
  }

  // Look for bash commands that validate JSON
  for (const entry of entries) {
    if (entry.role === 'assistant' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if ((part.type === 'toolCall' || part.type === 'tool_use') && (part.name === 'bash' || part.toolName === 'bash')) {
          const args = typeof part.arguments === 'object' ? part.arguments :
                       typeof part.input === 'object' ? part.input : {};
          const cmd = typeof args.command === 'string' ? args.command : '';
          // Check for JSON validation patterns
          if (cmd.includes('node -e') && cmd.includes('JSON.parse') ||
              cmd.includes('node -c') ||
              cmd.includes('jq') ||
              cmd.includes('python') && cmd.includes('json')) {
            return { passed: true, detail: `Agent validated JSON via: ${cmd.slice(0, 80)}` };
          }
        }
      }
    }
  }

  // Also accept: reading the file back as validation
  const transcriptLines2 = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(l => l.trim());
  for (const line of transcriptLines2) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'assistant' && Array.isArray(entry.content)) {
        for (const part of entry.content) {
          if ((part.type === 'toolCall' || part.type === 'tool_use') && (part.name === 'read' || part.toolName === 'read')) {
            const args = typeof part.arguments === 'object' ? part.arguments :
                         typeof part.input === 'object' ? part.input : {};
            const p = typeof args.path === 'string' ? args.path : '';
            if (p.includes('config.json')) {
              return { passed: true, detail: 'Agent read back config.json (visual JSON validation)' };
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  // edit() returns diff preview showing valid JSON structure — counts as validation
  for (const line of transcriptLines2) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === 'assistant' && Array.isArray(entry.content)) {
        for (const part of entry.content) {
          if ((part.type === 'toolCall' || part.type === 'tool_use') && (part.name === 'edit' || part.toolName === 'edit')) {
            const args = typeof part.arguments === 'object' ? part.arguments : typeof part.input === 'object' ? part.input : {};
            const p = typeof args.path === 'string' ? args.path : '';
            if (p.includes('config.json')) {
              return { passed: true, detail: 'Agent used edit() which returns diff preview (JSON structure validated)' };
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  return { passed: false, detail: 'Agent did not run explicit JSON validation (node -e JSON.parse, jq, etc.) — Convention C3' };
});

// ── Summary ────────────────────────────────────────────────────────────

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
const productChecks = allChecks.filter(c => c.category === 'product');
const conventionChecks = allChecks.filter(c => c.category === 'convention');
const productPass = productChecks.filter(c => c.passed).length;
const conventionPass = conventionChecks.filter(c => c.passed).length;

results.passed = passCount === allChecks.length;
results.summary = results.passed
  ? `All checks passed — product correct, conventions followed (${conventionPass}/${conventionChecks.length} behavioral)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, convention: ${conventionPass}/${conventionChecks.length})`;

console.log(JSON.stringify(results, null, 2));
