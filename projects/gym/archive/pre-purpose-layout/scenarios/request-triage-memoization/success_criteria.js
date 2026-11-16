/**
 * Success Criteria for "request-triage-memoization"
 *
 * Tests the request-triage-memoization skill: use cached triage decisions to
 * skip re-evaluating known-dismissed requests. The environment has:
 *   - 7 pending requests (aaa111, bbb222, ccc333, ddd444, eee555, fff666, ggg777)
 *   - A triage cache with 4 prior decisions: aaa111 (dismissed), bbb222 (dismissed),
 *     ddd444 (dismissed), eee555 (deferred)
 *   - 3 genuinely new requests: ccc333, fff666, ggg777
 *
 * The ideal agent should:
 *   1. Read the triage cache BEFORE reading individual request artifacts
 *   2. Skip re-evaluating cached-dismissed requests (aaa111, bbb222, ddd444)
 *   3. Fully evaluate new requests by reading their artifacts (fff666, ggg777, ccc333)
 *   4. Append new decisions to the triage cache
 *   5. Complete efficiently (fewer ops than evaluating all 7 from scratch)
 *
 * Product:
 *   P1: triage-results.md exists with decisions for all requests
 *   P2: triage-cache.jsonl has more entries than it started with
 *
 * Behavior:
 *   B1: Agent reads triage-cache.jsonl before reading any artifact files
 *   B2: Agent does NOT read all 7 artifact files (skips at least 2 cached ones)
 *   B3: Agent reads artifacts for at least 1 genuinely new request (fff666 or ggg777)
 *   B4: Agent calls finish() with success status
 *
 * Efficiency:
 *   E1: Total operations ≤ 20 (reading cache + 3 new artifacts + write results + update cache ≈ 8-12 ops)
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Helpers ───────────────────────────────────────────────────────────

const CACHED_REQS = ["aaa111", "bbb222", "ddd444"];  // dismissed in cache
const NEW_REQS = ["ccc333", "fff666", "ggg777"];       // not in cache
const ALL_REQS = ["aaa111", "bbb222", "ccc333", "ddd444", "eee555", "fff666", "ggg777"];

function countArtifactReads(transcript, reqIds) {
  if (!transcript) return 0;
  let count = 0;
  for (const e of transcript) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};
    const p = String(args.path || args.command || "");

    for (const reqId of reqIds) {
      const artifactName = `req-${reqId}`;
      if ((tool === "read" || tool === "bash") && p.includes(artifactName)) {
        count++;
        break; // don't double-count if multiple reqIds match same entry
      }
    }
  }
  return count;
}

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("triage-results-exist", "workspace/triage-results.md exists with triage decisions", () => {
  const raw = s.readFile("workspace/triage-results.md");
  if (!raw) return false;
  // Should mention at least some request IDs
  const mentionCount = ALL_REQS.filter(r => raw.includes(r)).length;
  return mentionCount >= 4; // at least 4 of 7 requests addressed
});

s.checkProduct("cache-updated", "triage-cache.jsonl has more entries than the initial 4", () => {
  const raw = s.readFile("workspace/triage-cache.jsonl");
  if (!raw) return false;
  const lines = raw.split("\n").filter(l => l.trim());
  return lines.length > 4; // started with 4 entries
});

// ── Behavioral Checks ─────────────────────────────────────────────────

// B1: Agent reads triage cache before reading artifact files
s.checkBehavior("cache-before-artifacts", "Agent reads triage-cache.jsonl before any artifact reads", () => {
  if (!s.hasTranscript()) return true; // vacuously true

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  let cacheReadIndex = Infinity;
  let firstArtifactIndex = Infinity;

  for (const e of t) {
    const tool = e.tool || e.name || "";
    const args = e.arguments || {};
    const p = String(args.path || args.command || "");

    // Check for cache read
    if (p.includes("triage-cache")) {
      cacheReadIndex = Math.min(cacheReadIndex, e.entryIndex);
    }

    // Check for artifact reads
    if (ALL_REQS.some(r => p.includes(`req-${r}`))) {
      firstArtifactIndex = Math.min(firstArtifactIndex, e.entryIndex);
    }
  }

  // If no artifact reads at all, that's fine (agent used cache only)
  if (firstArtifactIndex === Infinity) return true;

  // Cache must be read before first artifact
  return cacheReadIndex < firstArtifactIndex;
});

// B2: Agent skips at least 2 cached-dismissed request artifacts
s.checkBehavior("skips-cached-requests", "Agent does NOT read all 7 artifact files (skips ≥2 cached)", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  // Count how many of the cached-dismissed requests had their artifacts read
  const cachedReads = countArtifactReads(t, CACHED_REQS);

  // Agent should skip at least 2 of the 3 cached-dismissed requests
  return cachedReads <= 1;
});

// B3: Agent reads artifacts for at least 1 new request
s.checkBehavior("evaluates-new-requests", "Agent reads artifact for ≥1 genuinely new request (fff666, ggg777, ccc333)", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  const newReads = countArtifactReads(t, NEW_REQS);
  return newReads >= 1;
});

// B4: Agent calls finish() with success
s.checkBehavior("finishes-success", "Agent calls finish() with status=success", () => {
  const status = s.finishStatus();
  return status === "success";
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("low-ops", "Total operations ≤ 20 (efficient cache-based triage)", () => {
  return s.ops() <= 20;
});

s.report();
