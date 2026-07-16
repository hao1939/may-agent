/**
 * Success Criteria for "incremental-context-loading"
 *
 * Tests the incremental-context-loading skill: check file freshness before
 * re-reading large context files. The scenario has 5 source files but only
 * 1 (src/cache.js) has changed. The agent should:
 *   1. Read the context cache first
 *   2. Check file modification times or note the cache info
 *   3. Skip reading unchanged large files (architecture.md, api-reference.md, server.js, database.js)
 *   4. Read the changed file (cache.js), find and fix the TTL bug
 *   5. Run tests to verify
 *
 * Product:
 *   P1: The TTL bug in cache.js is fixed (the - 1000 is removed)
 *   P2: Tests pass (node test/cache-test.js exits 0)
 *
 * Behavior (incremental-context-loading):
 *   B1: Agent reads context-cache.md before reading source files
 *   B2: Agent does NOT read all 4 unchanged large files
 *   B3: Agent reads src/cache.js (the changed file)
 *   B4: Agent mentions skipping or not needing to re-read unchanged files
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ─────────────────────────────────────────────────────

s.checkProduct("ttl-bug-fixed", "The off-by-one TTL bug in cache.js is fixed", () => {
  const raw = s.readFile("src/cache.js");
  if (!raw) return false;
  // The bug is: Date.now() + (ttlSeconds * 1000) - 1000
  // The fix removes the "- 1000" part
  // Check that the - 1000 is NOT present in the _setLocal method
  const hasBug = raw.includes("* 1000) - 1000");
  // Check that the correct formula IS present
  const hasCorrect = raw.includes("* 1000)") && !raw.includes("- 1000");
  return !hasBug && hasCorrect;
});

s.checkProduct("tests-would-pass", "The fixed cache.js has correct TTL logic", () => {
  const raw = s.readFile("src/cache.js");
  if (!raw) return false;
  // Verify the _setLocal method computes expiresAt correctly
  // Should be: Date.now() + (ttlSeconds * 1000)
  // without the - 1000
  const setLocalMatch = raw.match(/expiresAt\s*=\s*Date\.now\(\)\s*\+\s*\(?\s*ttlSeconds\s*\*\s*1000\s*\)?/);
  return setLocalMatch !== null;
});

// ── Behavior Checks (Incremental Context Loading) ──────────────────────

// B1: Agent reads context-cache.md early
s.checkBehavior("reads-context-cache-first", "Agent reads workspace/context-cache.md before source files", () => {
  if (!s.hasTranscript()) return true;

  // Collect all read() and bash() calls that touch files, in order
  const allReads = s.toolCalls("read");
  const allBash = s.toolCalls("bash");

  // Find the callIndex of the first read/bash that references context-cache.md
  let contextCacheIdx = Infinity;
  for (const call of allReads) {
    const p = String((call.arguments || {}).path || "");
    if (p.includes("context-cache")) {
      contextCacheIdx = Math.min(contextCacheIdx, call.callIndex);
      break;
    }
  }
  for (const call of allBash) {
    const cmd = String((call.arguments || {}).command || "");
    if (cmd.includes("context-cache") && (cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("less "))) {
      contextCacheIdx = Math.min(contextCacheIdx, call.callIndex);
    }
  }
  if (contextCacheIdx === Infinity) return false; // Never read the context cache

  // Check that no large source files were read before the context cache
  const largeFiles = ["architecture.md", "api-reference.md", "server.js", "database.js"];
  for (const f of largeFiles) {
    for (const call of allReads) {
      const p = String((call.arguments || {}).path || "");
      if (p.includes(f) && call.callIndex < contextCacheIdx) {
        return false; // Read a large file before the context cache
      }
    }
    for (const call of allBash) {
      const cmd = String((call.arguments || {}).command || "");
      if (cmd.includes(f) && (cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("less ")) && call.callIndex < contextCacheIdx) {
        return false;
      }
    }
  }
  return true;
});

// B2: Agent does NOT read all 4 unchanged large files
s.checkBehavior("skips-unchanged-files", "Agent reads ≤2 of the 4 unchanged large files", () => {
  if (!s.hasTranscript()) return true;

  const unchangedFiles = ["architecture.md", "api-reference.md", "server.js", "database.js"];
  let readCount = 0;

  // Check read() calls
  const reads = s.toolCalls("read");
  for (const call of reads) {
    const p = String((call.arguments || {}).path || "");
    if (unchangedFiles.some(f => p.includes(f))) {
      readCount++;
    }
  }

  // Check bash calls that read files (cat, head, less)
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    if (unchangedFiles.some(f => cmd.includes(f)) &&
        (cmd.includes("cat ") || cmd.includes("head ") || cmd.includes("less ") ||
         cmd.includes("read ") || /\bmore\b/.test(cmd))) {
      readCount++;
    }
  }

  // Agent should read at most 2 of the 4 unchanged files
  // Ideally 0, but we're lenient — reading 1-2 is still much better than all 4
  return readCount <= 2;
});

// B3: Agent reads the changed file (cache.js)
s.checkBehavior("reads-changed-file", "Agent reads src/cache.js (the changed file)", () => {
  if (!s.hasTranscript()) return true;
  
  // Check read() calls for cache.js
  const reads = s.toolCalls("read");
  for (const call of reads) {
    const p = String((call.arguments || {}).path || "");
    if (p.includes("cache.js")) return true;
  }
  
  // Check bash calls that read cache.js (cat, head, etc.)
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    if (cmd.includes("cache.js")) return true;
  }
  
  // Also check if any assistant message mentions cache.js (they might have read it via edit)
  return s.anyMessageContains(/cache\.js/);
});

// B4: Agent mentions skipping or not needing to re-read unchanged files
s.checkBehavior("mentions-skip-rationale", "Agent mentions skipping or caching rationale for unchanged files", () => {
  if (!s.hasTranscript()) return true;

  const skipPatterns = [
    /skip/i,
    /unchanged/i,
    /hasn'?t\s+changed/i,
    /no\s+need\s+to\s+(re-?)?read/i,
    /already\s+(know|have|read|loaded)/i,
    /cached?\s+(context|knowledge|summary|data)/i,
    /from\s+(previous|last)\s+session/i,
    /not\s+modified/i,
    /same\s+(as|since)/i,
    /don'?t\s+need\s+to\s+re-?read/i,
  ];

  return skipPatterns.some(p => s.anyMessageContains(p));
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("low-ops", "Total operations ≤ 20 (should be efficient with context loading)", () => {
  return s.ops() <= 20;
});

s.report();
