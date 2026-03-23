/**
 * Success Criteria for "edit-precision"
 *
 * Tests both PRODUCT (correct config) and PROCESS (precise editing):
 *
 * Product:
 *   P1. api-backend proxy_pass changed to http://localhost:4000
 *   P2. api-backend has the new X-Request-ID header
 *   P3. web-frontend block is unchanged
 *   P4. admin-panel block is unchanged
 *
 * Process:
 *   E1. Agent read the file before editing (understood structure)
 *   E2. Agent used precise edit targeting (not whole-file rewrite)
 *
 * Trap: Three very similar server blocks. The proxy_set_header lines are
 *       nearly identical across all three. An imprecise edit will match the
 *       wrong block or modify all three.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'edit-precision',
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

// Helper: extract server blocks from nginx.conf
function extractServerBlocks(content) {
  const blocks = {};
  // Find blocks by the comment headers
  const webMatch = content.match(/# ─── Web Frontend[─ ]*\n([\s\S]*?)(?=# ───|$)/);
  const apiMatch = content.match(/# ─── API Backend[─ ]*\n([\s\S]*?)(?=# ───|$)/);
  const adminMatch = content.match(/# ─── Admin Panel[─ ]*\n([\s\S]*?)(?=# ───|}[\s]*$)/);

  blocks.web = webMatch ? webMatch[1] : '';
  blocks.api = apiMatch ? apiMatch[1] : '';
  blocks.admin = adminMatch ? adminMatch[1] : '';
  return blocks;
}

// ── Product Checks ─────────────────────────────────────────────────────

check('P1: api-proxy-pass-updated', 'product', () => {
  const confPath = path.join(envDir, 'nginx.conf');
  if (!fs.existsSync(confPath)) {
    return { passed: false, detail: 'nginx.conf does not exist' };
  }
  const content = fs.readFileSync(confPath, 'utf-8');
  const blocks = extractServerBlocks(content);

  if (blocks.api.includes('proxy_pass http://localhost:4000')) {
    return { passed: true, detail: 'API backend proxy_pass updated to localhost:4000' };
  }
  if (blocks.api.includes('proxy_pass http://localhost:3000')) {
    return { passed: false, detail: 'API backend proxy_pass still points to localhost:3000' };
  }
  return { passed: false, detail: 'Could not find proxy_pass in API backend block' };
});

check('P2: api-request-id-header', 'product', () => {
  const confPath = path.join(envDir, 'nginx.conf');
  if (!fs.existsSync(confPath)) {
    return { passed: false, detail: 'nginx.conf does not exist' };
  }
  const content = fs.readFileSync(confPath, 'utf-8');
  const blocks = extractServerBlocks(content);

  if (blocks.api.includes('X-Request-ID') && blocks.api.includes('$request_id')) {
    return { passed: true, detail: 'X-Request-ID header added to API backend block' };
  }
  return { passed: false, detail: 'X-Request-ID header not found in API backend block' };
});

check('P3: web-frontend-unchanged', 'product', () => {
  const confPath = path.join(envDir, 'nginx.conf');
  if (!fs.existsSync(confPath)) {
    return { passed: false, detail: 'nginx.conf does not exist' };
  }
  const content = fs.readFileSync(confPath, 'utf-8');
  const blocks = extractServerBlocks(content);

  const issues = [];
  if (!blocks.web.includes('proxy_pass http://localhost:8080')) {
    issues.push('web-frontend proxy_pass changed (should be localhost:8080)');
  }
  if (blocks.web.includes('X-Request-ID')) {
    issues.push('web-frontend has X-Request-ID header (should not)');
  }
  if (blocks.web.includes('localhost:4000')) {
    issues.push('web-frontend references localhost:4000 (should not)');
  }

  if (issues.length > 0) {
    return { passed: false, detail: `Web frontend modified: ${issues.join('; ')}` };
  }
  return { passed: true, detail: 'Web frontend block unchanged' };
});

check('P4: admin-panel-unchanged', 'product', () => {
  const confPath = path.join(envDir, 'nginx.conf');
  if (!fs.existsSync(confPath)) {
    return { passed: false, detail: 'nginx.conf does not exist' };
  }
  const content = fs.readFileSync(confPath, 'utf-8');
  const blocks = extractServerBlocks(content);

  const issues = [];
  if (!blocks.admin.includes('proxy_pass http://localhost:9090')) {
    issues.push('admin-panel proxy_pass changed (should be localhost:9090)');
  }
  if (blocks.admin.includes('X-Request-ID')) {
    issues.push('admin-panel has X-Request-ID header (should not)');
  }
  if (blocks.admin.includes('localhost:4000')) {
    issues.push('admin-panel references localhost:4000 (should not)');
  }

  if (issues.length > 0) {
    return { passed: false, detail: `Admin panel modified: ${issues.join('; ')}` };
  }
  return { passed: true, detail: 'Admin panel block unchanged' };
});

// ── Process Checks ─────────────────────────────────────────────────────

check('E1: read-before-edit', 'process', () => {
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

  // Check agent read or catted the file before editing
  const reads = toolCalls.filter(tc =>
    (tc.name === 'read' && typeof tc.args.path === 'string' && tc.args.path.includes('nginx.conf')) ||
    (tc.name === 'bash' && typeof tc.args.command === 'string' && tc.args.command.includes('nginx.conf') && (
      tc.args.command.includes('cat') || tc.args.command.includes('head') || tc.args.command.includes('grep')
    ))
  );

  const edits = toolCalls.filter(tc =>
    (tc.name === 'edit' || tc.name === 'write') &&
    typeof tc.args.path === 'string' && tc.args.path.includes('nginx.conf')
  );

  if (reads.length > 0) {
    const firstRead = toolCalls.indexOf(reads[0]);
    const firstEdit = edits.length > 0 ? toolCalls.indexOf(edits[0]) : Infinity;
    if (firstRead < firstEdit) {
      return { passed: true, detail: 'Agent read nginx.conf before editing' };
    }
  }

  return { passed: false, detail: 'Agent did not read the file before editing (risky with repetitive structure)' };
});

check('E2: precise-targeting', 'process', () => {
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

  // Check: did agent use `edit` with specific oldText (not whole-file write)?
  const edits = toolCalls.filter(tc =>
    tc.name === 'edit' && typeof tc.args.path === 'string' && tc.args.path.includes('nginx.conf')
  );
  const writes = toolCalls.filter(tc =>
    tc.name === 'write' && typeof tc.args.path === 'string' && tc.args.path.includes('nginx.conf')
  );

  if (edits.length > 0 && writes.length === 0) {
    // Check that oldText is specific enough (includes api-specific content)
    const preciseEdit = edits.some(tc => {
      const oldText = tc.args.oldText || '';
      return oldText.includes('api') || oldText.includes('3000') || oldText.includes('api.example.com');
    });
    if (preciseEdit) {
      return { passed: true, detail: 'Agent used edit with API-specific oldText (precise targeting)' };
    }
    return { passed: true, detail: 'Agent used edit tool (not write)' };
  }

  if (writes.length > 0) {
    return { passed: false, detail: 'Agent used write to rewrite entire nginx.conf — risky with repetitive structure' };
  }

  // Also accept bash sed with specific targeting
  const bashSed = toolCalls.filter(tc =>
    tc.name === 'bash' && typeof tc.args.command === 'string' &&
    tc.args.command.includes('sed') && tc.args.command.includes('nginx.conf')
  );
  if (bashSed.length > 0) {
    return { passed: true, detail: 'Agent used bash sed for targeted edit' };
  }

  return { passed: false, detail: 'No edit or write to nginx.conf found' };
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
  ? `All checks passed — precise edit to correct block, other blocks untouched (${processPass}/${processChecks.length} process)`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, process: ${processPass}/${processChecks.length})`;

console.log(JSON.stringify(results, null, 2));
