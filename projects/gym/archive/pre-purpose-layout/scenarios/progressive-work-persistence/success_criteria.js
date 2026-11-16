/**
 * Success Criteria for "progressive-work-persistence"
 *
 * Tests whether the agent:
 * 1. Produced all 3 analysis files
 * 2. Each analysis file has meaningful content (not empty/stub)
 * 3. BEHAVIORAL: Wrote files progressively (after each module analyzed)
 *    rather than batching all writes at the end
 *
 * The progressive write pattern is checked by examining the transcript
 * to see if write operations are interspersed with read/analysis operations,
 * or if all writes are clustered at the end.
 *
 * Designed to test: progressive-work-persistence skill
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'progressive-work-persistence',
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

// ── Check 1-3: All 3 analysis files exist with meaningful content ──

const analysisFiles = ['analysis-auth.md', 'analysis-cache.md', 'analysis-billing.md'];

for (const fileName of analysisFiles) {
  check(`${fileName}-exists-and-meaningful`, () => {
    const filePath = path.join(envDir, fileName);
    if (!fs.existsSync(filePath)) {
      return { passed: false, detail: `${fileName} not found` };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length < 100) {
      return { passed: false, detail: `${fileName} too short (${content.length} chars) — likely stub` };
    }
    // Check for expected sections
    const hasSummary = /summary/i.test(content);
    const hasBugs = /bug/i.test(content);
    const hasRecommendation = /recommend/i.test(content) || /improvement/i.test(content) || /suggest/i.test(content);
    const meaningful = hasSummary && hasBugs;
    return {
      passed: meaningful,
      detail: meaningful
        ? `${fileName}: ${content.length} chars, has summary and bug analysis`
        : `${fileName}: missing expected sections (summary: ${hasSummary}, bugs: ${hasBugs}, recs: ${hasRecommendation})`
    };
  });
}

// ── Check 4: Progressive write pattern (behavioral) ──
// Examine the transcript to see if writes were interspersed with reads
// rather than all clustered at the end.

check('progressive-write-pattern', () => {
  const transcriptPath = path.join(envDir, 'transcript.jsonl');

  // If no transcript available, check file modification timestamps as fallback
  if (!fs.existsSync(transcriptPath)) {
    // Fallback: just check that all files exist (can't verify ordering)
    const allExist = analysisFiles.every(f => fs.existsSync(path.join(envDir, f)));
    return {
      passed: false,
      detail: 'No transcript available — cannot verify progressive write pattern'
    };
  }

  // Parse transcript JSONL
  const lines = fs.readFileSync(transcriptPath, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);

  // Look for tool_use events (writes to analysis files, reads of source files)
  // The exact format depends on the runtime, so we do a flexible search
  const toolEvents = [];
  for (const entry of lines) {
    const text = JSON.stringify(entry).toLowerCase();

    // Detect writes to analysis files
    for (const f of analysisFiles) {
      if (text.includes(f.toLowerCase()) && (text.includes('write') || text.includes('create'))) {
        toolEvents.push({ type: 'write', file: f, index: toolEvents.length });
      }
    }

    // Detect reads of source files
    for (const src of ['auth.js', 'cache.js', 'billing.js']) {
      if (text.includes(src) && (text.includes('read') || text.includes('cat '))) {
        toolEvents.push({ type: 'read', file: src, index: toolEvents.length });
      }
    }
  }

  if (toolEvents.length === 0) {
    return { passed: false, detail: 'Could not parse tool events from transcript' };
  }

  // Find positions of writes
  const writePositions = toolEvents
    .map((e, i) => e.type === 'write' ? i : -1)
    .filter(i => i >= 0);

  const readPositions = toolEvents
    .map((e, i) => e.type === 'read' ? i : -1)
    .filter(i => i >= 0);

  if (writePositions.length === 0) {
    return { passed: false, detail: 'No write events found in transcript' };
  }

  // Progressive pattern: writes should be interspersed with reads
  // Batch pattern: all writes are at the end (after all reads)
  //
  // Heuristic: if ALL writes come after ALL reads, that's batching.
  // If at least one write comes between reads, that's progressive.

  const lastReadPos = readPositions.length > 0 ? Math.max(...readPositions) : -1;
  const firstWritePos = Math.min(...writePositions);

  // Check: is there at least one read that comes AFTER a write?
  // (meaning the agent wrote one analysis, then went back to read the next module)
  const hasInterleavedPattern = writePositions.some(wp =>
    readPositions.some(rp => rp > wp)
  );

  // Also check: are writes spread out (not all in a tight cluster at the end)?
  const writeSpread = writePositions.length >= 2
    ? writePositions[writePositions.length - 1] - writePositions[0]
    : 0;
  const totalSpan = toolEvents.length;
  const isSpread = writeSpread > totalSpan * 0.2; // writes span at least 20% of tool events

  const isProgressive = hasInterleavedPattern || isSpread;

  return {
    passed: isProgressive,
    detail: isProgressive
      ? `Progressive: writes interspersed with reads (${writePositions.length} writes, ${readPositions.length} reads, interleaved: ${hasInterleavedPattern}, spread: ${writeSpread}/${totalSpan})`
      : `Batched: all writes clustered at end (write positions: [${writePositions.join(',')}], read positions: [${readPositions.join(',')}], total events: ${totalSpan})`
  };
});

// ── Overall ──
const allChecks = results.checks;
const passedCount = allChecks.filter(c => c.passed).length;
results.passed = passedCount >= 3; // At least 3 of 4 (must have all files; progressive is the stretch goal)
results.summary = results.passed
  ? `${passedCount}/${allChecks.length} checks passed — agent produced all analyses${passedCount === allChecks.length ? ' with progressive write pattern' : ''}`
  : `${passedCount}/${allChecks.length} checks passed — ${allChecks.filter(c => !c.passed).map(c => c.name).join(', ')} failed`;

console.log(JSON.stringify(results, null, 2));
