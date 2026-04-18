/**
 * Success Criteria for "knowledge-base-navigation"
 *
 * Tests PRODUCT (correct synthesis report) and CONVENTION (efficient navigation):
 *
 * Product:
 *   1. synthesis.md exists
 *   2. Has active hypotheses section with RH-044 and RH-048
 *   3. Has evidence gap section identifying pending verification entries
 *   4. Has FM-1.3 key finding from deep dive
 *   5. Has cross-reference check (RX-031 vs RKE-003 alignment)
 *
 * Convention (Navigation Efficiency):
 *   1. Total tool calls ≤ 25 (efficient navigation)
 *   2. No path-guessing errors (≤1 ENOENT on non-existent path)
 *   3. Uses ls or find early (discovers structure before diving)
 *   4. Finds INDEX.md early (within first 5 tool calls)
 *   5. Doesn't read ALL files (reads ≤12 of 17 files)
 */

const path = require('path');
const fs = require('fs');

const workDir = process.argv[2] || __dirname;
const envDir = path.join(workDir, 'environment');
const transcriptPath = path.join(workDir, 'transcript.jsonl');

const results = {
  scenario: 'knowledge-base-navigation',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, category, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, message: result.detail, category });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, message: `Error: ${err.message}`, category });
    return false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function readTranscript() {
  if (!fs.existsSync(transcriptPath)) return [];
  const content = fs.readFileSync(transcriptPath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function getToolCalls(entries) {
  // Count tool call entries — handle both formats:
  // Format A (Claude API): block.type === 'tool_use'
  // Format B (May adapter): block.type === 'toolCall'
  let count = 0;
  for (const entry of entries) {
    if (entry.type === 'tool_use' || entry.type === 'toolCall') {
      count++;
    }
    if (entry.content && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === 'tool_use' || block.type === 'toolCall') count++;
      }
    }
  }
  return count;
}

function getReadPaths(entries) {
  const paths = [];
  for (const entry of entries) {
    const blocks = entry.content && Array.isArray(entry.content) ? entry.content : [entry];
    for (const block of blocks) {
      if ((block.type === 'tool_use' || block.type === 'toolCall') && block.name === 'read') {
        // Handle both input formats: block.input (Claude) or block.arguments (May)
        const args = block.input || block.arguments || {};
        paths.push(args.path || '');
      }
    }
  }
  return paths;
}

function getBashCommands(entries) {
  const cmds = [];
  for (const entry of entries) {
    const blocks = entry.content && Array.isArray(entry.content) ? entry.content : [entry];
    for (const block of blocks) {
      if ((block.type === 'tool_use' || block.type === 'toolCall') && block.name === 'bash') {
        const args = block.input || block.arguments || {};
        cmds.push(args.command || '');
      }
    }
  }
  return cmds;
}

function getToolResults(entries) {
  const results = [];
  for (const entry of entries) {
    // May adapter format: top-level role=toolResult
    if (entry.role === 'toolResult') {
      results.push(entry);
    }
    const blocks = entry.content && Array.isArray(entry.content) ? entry.content : [entry];
    for (const block of blocks) {
      if (block.type === 'tool_result') {
        results.push(block);
      }
    }
  }
  return results;
}

// ── Product Checks ─────────────────────────────────────────────────────

check('synthesis-exists', 'product', () => {
  const synthPath = path.join(workDir, 'synthesis.md');
  const exists = fs.existsSync(synthPath);
  return { passed: exists, detail: exists ? 'synthesis.md exists' : 'synthesis.md not found in workDir' };
});

check('has-hypotheses-section', 'product', () => {
  const synthPath = path.join(workDir, 'synthesis.md');
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'No synthesis.md' };
  const content = fs.readFileSync(synthPath, 'utf8').toLowerCase();
  const hasH044 = content.includes('rh-044') || content.includes('h-044');
  const hasH048 = content.includes('rh-048') || content.includes('h-048');
  const hasHypSection = content.includes('hypothes');
  return {
    passed: hasH044 && hasH048 && hasHypSection,
    detail: `Hypotheses section: ${hasHypSection}, RH-044: ${hasH044}, RH-048: ${hasH048}`
  };
});

check('has-evidence-gap', 'product', () => {
  const synthPath = path.join(workDir, 'synthesis.md');
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'No synthesis.md' };
  const content = fs.readFileSync(synthPath, 'utf8').toLowerCase();
  // Should mention pending verification entries (RKE-011 and RKE-015)
  const hasPending = content.includes('pending') || content.includes('verification') || content.includes('evidence gap');
  const mentionsEntries = (content.includes('rke-011') || content.includes('rke-015'));
  return {
    passed: hasPending && mentionsEntries,
    detail: `Evidence gap section: pending=${hasPending}, entries=${mentionsEntries}`
  };
});

check('has-fm13-finding', 'product', () => {
  const synthPath = path.join(workDir, 'synthesis.md');
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'No synthesis.md' };
  const content = fs.readFileSync(synthPath, 'utf8').toLowerCase();
  const hasFM13 = content.includes('fm-1.3') || content.includes('path-guessing') || content.includes('path guessing');
  const hasDefinition = content.includes('flailing') || content.includes('constructs file paths') || content.includes('guessing');
  return {
    passed: hasFM13 && hasDefinition,
    detail: `FM-1.3 finding: mentioned=${hasFM13}, defined=${hasDefinition}`
  };
});

check('has-cross-reference', 'product', () => {
  const synthPath = path.join(workDir, 'synthesis.md');
  if (!fs.existsSync(synthPath)) return { passed: false, detail: 'No synthesis.md' };
  const content = fs.readFileSync(synthPath, 'utf8').toLowerCase();
  const hasRX031 = content.includes('rx-031');
  const hasRKE003 = content.includes('rke-003');
  const hasAlignment = content.includes('align') || content.includes('agree') || content.includes('consistent') || content.includes('confirm') || content.includes('support');
  return {
    passed: hasRX031 && hasRKE003 && hasAlignment,
    detail: `Cross-ref: RX-031=${hasRX031}, RKE-003=${hasRKE003}, alignment=${hasAlignment}`
  };
});

// ── Convention Checks (Navigation Efficiency) ──────────────────────────

check('nav-total-tool-calls-under-25', 'convention', () => {
  const entries = readTranscript();
  if (entries.length === 0) return { passed: false, detail: 'No transcript' };
  const count = getToolCalls(entries);
  return {
    passed: count > 0 && count <= 25,
    detail: `${count} tool calls (threshold: ≤25)`
  };
});

check('nav-no-path-guessing-errors', 'convention', () => {
  const entries = readTranscript();
  if (entries.length === 0) return { passed: false, detail: 'No transcript' };
  // Count ENOENT / "not found" / error responses
  let enoentCount = 0;
  for (const entry of entries) {
    // May adapter format: role=toolResult with content array of {type:"text", text:"..."}
    if (entry.role === 'toolResult') {
      const content = entry.content;
      const texts = [];
      if (typeof content === 'string') texts.push(content);
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === 'string') texts.push(block);
          if (typeof block?.text === 'string') texts.push(block.text);
        }
      }
      for (const t of texts) {
        if (t.includes('ENOENT') || t.includes('No such file') ||
            t.includes('does not exist')) {
          enoentCount++;
          break; // Count once per toolResult
        }
      }
      continue;
    }
    // Claude API format: block.type === 'tool_result'
    const blocks = entry.content && Array.isArray(entry.content) ? entry.content : [entry];
    for (const block of blocks) {
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        if (block.content.includes('ENOENT') || block.content.includes('No such file') ||
            block.content.includes('does not exist')) {
          enoentCount++;
        }
      }
      if (block.type === 'tool_result' && Array.isArray(block.content)) {
        for (const sub of block.content) {
          if (typeof sub.text === 'string' &&
              (sub.text.includes('ENOENT') || sub.text.includes('No such file') ||
               sub.text.includes('does not exist'))) {
            enoentCount++;
          }
        }
      }
    }
  }
  return {
    passed: enoentCount <= 1,
    detail: `${enoentCount} path errors (threshold: ≤1)`
  };
});

check('nav-uses-ls-or-find-first', 'convention', () => {
  const entries = readTranscript();
  if (entries.length === 0) return { passed: false, detail: 'No transcript' };
  const bashCmds = getBashCommands(entries);
  // Check if ls/find is used at any point to discover directory structure
  const firstLsOrFind = bashCmds.findIndex(cmd => 
    cmd.includes('ls ') || cmd.startsWith('ls') || cmd.includes('find ') || cmd.includes('tree')
  );
  const usesLsFirst = firstLsOrFind >= 0;
  return {
    passed: usesLsFirst,
    detail: usesLsFirst ? `ls/find used (bash command #${firstLsOrFind + 1})` : 'No ls/find detected'
  };
});

check('nav-finds-index-early', 'convention', () => {
  const entries = readTranscript();
  if (entries.length === 0) return { passed: false, detail: 'No transcript' };
  let toolCallNum = 0;
  let indexFoundAt = -1;
  for (const entry of entries) {
    const blocks = entry.content && Array.isArray(entry.content) ? entry.content : [entry];
    for (const block of blocks) {
      if (block.type === 'tool_use' || block.type === 'toolCall') {
        toolCallNum++;
        const args = block.input || block.arguments || {};
        if (block.name === 'read' && (args.path || '').includes('INDEX.md')) {
          if (indexFoundAt === -1) indexFoundAt = toolCallNum;
        }
        if (block.name === 'bash' && (args.command || '').includes('INDEX.md')) {
          if (indexFoundAt === -1) indexFoundAt = toolCallNum;
        }
      }
    }
  }
  return {
    passed: indexFoundAt > 0 && indexFoundAt <= 5,
    detail: indexFoundAt > 0 ? `INDEX.md found at tool call #${indexFoundAt} (threshold: ≤5)` : 'INDEX.md never read'
  };
});

check('nav-doesnt-read-all-files', 'convention', () => {
  const entries = readTranscript();
  if (entries.length === 0) return { passed: false, detail: 'No transcript' };
  const readPaths = getReadPaths(entries);
  const bashCmds = getBashCommands(entries);
  // Knowledge base directories (copied from environment/ into workDir root)
  const kbDirs = ['hypotheses/', 'entries/', 'experiments/', 'library/'];
  // Count unique KB files accessed
  const kbFilesRead = new Set();
  for (const p of readPaths) {
    // Check if path includes any KB directory
    for (const dir of kbDirs) {
      if (p.includes(dir)) {
        kbFilesRead.add(p);
        break;
      }
    }
    // INDEX.md at root is also a KB file
    if (p.endsWith('INDEX.md') && !p.includes('/')) {
      kbFilesRead.add(p);
    }
  }
  for (const cmd of bashCmds) {
    // Check for cat commands on KB files
    for (const dir of kbDirs) {
      const catMatch = cmd.match(new RegExp(`cat\\s+\\S*${dir}(\\S+)`));
      if (catMatch) kbFilesRead.add(`${dir}${catMatch[1]}`);
    }
  }
  const count = kbFilesRead.size;
  return {
    passed: count <= 12,
    detail: `${count} unique KB files read (threshold: ≤12 of 17)`
  };
});

// ── Compute final result ───────────────────────────────────────────────

const productChecks = results.checks.filter(c => c.category === 'product');
const conventionChecks = results.checks.filter(c => c.category === 'convention');
const productPassed = productChecks.filter(c => c.passed).length;
const conventionPassed = conventionChecks.filter(c => c.passed).length;

// Pass = 3+ product AND 3+ convention
results.passed = productPassed >= 3 && conventionPassed >= 3;
results.summary = `${productPassed}/${productChecks.length} product, ${conventionPassed}/${conventionChecks.length} convention`;

console.log(JSON.stringify(results, null, 2));
