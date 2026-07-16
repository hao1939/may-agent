/**
 * Success Criteria for "slippery-edit-acceptance"
 *
 * Tests whether the agent correctly edits config.yaml with a tricky layout
 * (commented-out duplicate section) and verifies the result.
 *
 * Product checks:
 *   P1: Active database.host is updated correctly
 *   P2: Active database.pool_size is updated correctly 
 *   P3: Active database.name is updated correctly
 *   P4: Commented-out legacy section preserved exactly
 *   P5: Other config sections (server, cache, logging) unchanged
 *
 * Process checks:
 *   B1: Agent reads file BEFORE editing (understands structure)
 *   B2: Agent verifies result AFTER editing (catches mistakes)
 *
 * Trap: The commented-out legacy section has similar key names (database.host,
 *       database.pool_size, database.name). A naive sed/regex approach may
 *       accidentally modify the commented lines too. The agent must either:
 *       (a) use precise editing that targets only uncommented lines, or
 *       (b) catch and fix the mistake if it happens.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'slippery-edit-acceptance',
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

function readConfig() {
  const configPath = path.join(envDir, 'config.yaml');
  if (!fs.existsSync(configPath)) return null;
  return fs.readFileSync(configPath, 'utf-8');
}

function getActiveValue(content, key) {
  // Parse YAML-like: find uncommented lines matching "  key: value"
  const lines = content.split('\n');
  let inActiveDatabase = false;
  for (const line of lines) {
    // Skip comments
    if (line.trim().startsWith('#')) continue;
    // Detect active database section
    if (/^database:/.test(line)) {
      inActiveDatabase = true;
      continue;
    }
    // Exit section on new top-level key
    if (inActiveDatabase && /^[a-z]/.test(line)) {
      inActiveDatabase = false;
    }
    if (inActiveDatabase) {
      const match = line.match(new RegExp(`^\\s+${key}:\\s*(.+)`));
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return null;
}

// ── Product Checks ─────────────────────────────────────────────────────

check('database-host-updated', 'product', () => {
  const content = readConfig();
  if (!content) return { passed: false, detail: 'config.yaml missing' };
  const host = getActiveValue(content, 'host');
  if (host === 'db.prod.internal.example.com') {
    return { passed: true, detail: 'database.host correctly updated' };
  }
  return { passed: false, detail: `database.host is "${host}", expected "db.prod.internal.example.com"` };
});

check('database-pool-updated', 'product', () => {
  const content = readConfig();
  if (!content) return { passed: false, detail: 'config.yaml missing' };
  const pool = getActiveValue(content, 'pool_size');
  if (pool === '20') {
    return { passed: true, detail: 'database.pool_size correctly updated to 20' };
  }
  return { passed: false, detail: `database.pool_size is "${pool}", expected "20"` };
});

check('database-name-updated', 'product', () => {
  const content = readConfig();
  if (!content) return { passed: false, detail: 'config.yaml missing' };
  const name = getActiveValue(content, 'name');
  if (name === 'myapp_v2') {
    return { passed: true, detail: 'database.name correctly updated to myapp_v2' };
  }
  return { passed: false, detail: `database.name is "${name}", expected "myapp_v2"` };
});

check('legacy-section-preserved', 'product', () => {
  const content = readConfig();
  if (!content) return { passed: false, detail: 'config.yaml missing' };
  
  // Check that the commented-out legacy section is exactly preserved
  const expectedLegacy = [
    '# database:',
    '#   host: "db.internal"',
    '#   port: 5432',
    '#   name: "myapp_legacy"',
    '#   pool_size: 5'
  ];
  
  for (const expected of expectedLegacy) {
    if (!content.includes(expected)) {
      return { passed: false, detail: `Legacy section modified — missing line: "${expected}"` };
    }
  }
  return { passed: true, detail: 'Commented-out legacy section preserved exactly' };
});

check('other-sections-unchanged', 'product', () => {
  const content = readConfig();
  if (!content) return { passed: false, detail: 'config.yaml missing' };
  
  const issues = [];
  
  // Check server section
  if (!content.includes('port: 8080')) issues.push('server.port changed');
  if (!content.includes('timeout: 30')) issues.push('server.timeout changed');
  
  // Check cache section
  if (!content.includes('ttl: 300')) issues.push('cache.ttl changed');
  if (!content.includes('max_entries: 1000')) issues.push('cache.max_entries changed');
  
  // Check logging section
  if (!content.includes('level: "info"')) issues.push('logging.level changed');
  
  if (issues.length > 0) {
    return { passed: false, detail: `Other sections modified: ${issues.join(', ')}` };
  }
  return { passed: true, detail: 'Server, cache, logging sections unchanged' };
});

// ── Process Checks ─────────────────────────────────────────────────────

check('read-before-edit', 'behavior', () => {
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

  // Find first write/edit to config.yaml
  const firstWrite = toolCalls.find(tc =>
    ((tc.name === 'write' || tc.name === 'edit') &&
     typeof tc.args.path === 'string' &&
     tc.args.path.includes('config.yaml')) ||
    (tc.name === 'bash' && typeof tc.args.command === 'string' &&
     tc.args.command.includes('config.yaml') &&
     (tc.args.command.includes('>') || tc.args.command.includes('sed ')))
  );

  if (!firstWrite) {
    return { passed: false, detail: 'No write/edit to config.yaml found' };
  }

  // Check for read before the first write
  const readBefore = toolCalls.find(tc =>
    tc.index < firstWrite.index && (
      (tc.name === 'read' && typeof tc.args.path === 'string' && tc.args.path.includes('config.yaml')) ||
      (tc.name === 'bash' && typeof tc.args.command === 'string' &&
       tc.args.command.includes('config.yaml') &&
       !tc.args.command.includes('>') && !tc.args.command.includes('sed '))
    )
  );

  if (readBefore) {
    return { passed: true, detail: 'Agent read config.yaml before editing' };
  }
  return { passed: false, detail: 'Agent edited config.yaml without reading it first' };
});

check('verify-after-edit', 'behavior', () => {
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

  // Find writes/edits to config.yaml
  const writes = toolCalls.filter(tc =>
    ((tc.name === 'write' || tc.name === 'edit') &&
     typeof tc.args.path === 'string' &&
     tc.args.path.includes('config.yaml')) ||
    (tc.name === 'bash' && typeof tc.args.command === 'string' &&
     tc.args.command.includes('config.yaml') &&
     (tc.args.command.includes('>') || tc.args.command.includes('sed ')))
  );

  if (writes.length === 0) {
    return { passed: false, detail: 'No write/edit found' };
  }

  const lastWrite = writes[writes.length - 1];

  // Check for verification after last write
  const verifyAfter = toolCalls.find(tc =>
    tc.index > lastWrite.index && (
      (tc.name === 'read' && typeof tc.args.path === 'string' && tc.args.path.includes('config.yaml')) ||
      (tc.name === 'bash' && typeof tc.args.command === 'string' &&
       tc.args.command.includes('config.yaml'))
    )
  );

  if (verifyAfter) {
    return { passed: true, detail: 'Agent verified config.yaml after editing' };
  }
  return { passed: false, detail: 'Agent did NOT verify config.yaml after editing' };
});

// ── Summary ────────────────────────────────────────────────────────────

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
const productChecks = allChecks.filter(c => c.category === 'product');
const behaviorChecks = allChecks.filter(c => c.category === 'behavior');
const productPass = productChecks.filter(c => c.passed).length;
const behaviorPass = behaviorChecks.filter(c => c.passed).length;

results.passed = passCount === allChecks.length;
results.summary = results.passed
  ? `All ${allChecks.length} checks passed — edits correct, legacy preserved, verification done`
  : `${passCount}/${allChecks.length} passed (product: ${productPass}/${productChecks.length}, behavior: ${behaviorPass}/${behaviorChecks.length})`;

console.log(JSON.stringify(results, null, 2));
