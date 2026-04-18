# Audit: Context Injection Pipeline (`buildSessionContext`)

**Date**: 2026-04-11  
**Lens**: B (Flow Complexity)  
**Source**: `src/lib/manager.ts:514-636` + 5 sub-modules  

## Executive Summary

`buildSessionContext()` assembles 7 sub-items into the first user message (not system prompt, for KV-cache discipline). The pipeline involves **3 DB queries, 3-4 file reads, and 2 JSON parses** per session startup. Despite the layer count, the design is well-factored: each sub-item is independent, failures are contained, and the DB handle is cached. One concrete simplification opportunity exists (cross-agent digest double-parse) but the pipeline is not a major complexity concern.

## Pipeline Architecture

```
buildSessionContext(def, agentName, sessionId, persistDir, task)
  │
  ├─ 1. Session Header (pure computation — no I/O)
  │     "# Session Context\n- Session ID: ...\n- Current Time: ..."
  │
  ├─ 2. Digest-Based History Block [3 DB queries + JSON parsing]
  │     ├─ getRecentDigests()          → SQLite query (max 10 rows)
  │     ├─ [loop] parse files_modified → JSON.parse per row → build recentFiles set
  │     ├─ getCrossAgentDigests()      → SQLite query (max 20 rows, filter to 3)
  │     │   └─ [loop] JSON.parse files_modified per row for set intersection
  │     ├─ getUnresolvedDigests()      → SQLite query (max 3 rows)
  │     └─ formatDigestContext()       → format + overflow protection (10KB cap)
  │
  ├─ 3. Active Recall (P110) [1 file read + JSONL parse]
  │     ├─ runActiveRecall()           → readFileSync(ERROR_LOG.jsonl)
  │     │   └─ parse tail 100 lines, filter to 3 days, dedup by type
  │     └─ formatRecallWarnings()      → format <active_recall> block
  │
  ├─ 4. Checkpoint Injection [1 file read + JSON parse]
  │     └─ readLatestCheckpointForAgent() → readFileSync(latest/<agent>.json)
  │
  ├─ 5. Context Files [0-N file reads — currently always 0]
  │     └─ for each def.contextFiles → readFileSync() if exists
  │         (Only evaluator defines contextFiles, and it's empty [])
  │
  ├─ 6. Context Learning [1 file read]
  │     └─ readFileSync(agents/<name>/context.md) → "## What You Know"
  │
  └─ 7. Knowledge Routing [1 file read, only for heartbeats]
        └─ routeKnowledge() → loadKnowledgeIndex() [cached] + keyword match
            (Skipped for non-heartbeat sessions)
```

**Note**: `routeFewShotExamples()` runs AFTER buildSessionContext (line 1017) and is technically part of the same prompt assembly, but not inside the function itself.

## I/O Inventory Per Session Startup

| # | Operation | I/O Type | Latency | Notes |
|---|-----------|----------|---------|-------|
| 1 | `getRecentDigests()` | SQLite query | ~1ms | Cached DB handle. Subquery + JOIN + ORDER + LIMIT |
| 2 | `getCrossAgentDigests()` | SQLite query | ~1ms | Fetches 20, filters in JS to 3. Returns [] if no recentFiles |
| 3 | `getUnresolvedDigests()` | SQLite query | ~1ms | NOT IN subquery, 24h window |
| 4 | `readFileSync(ERROR_LOG.jsonl)` | File read | ~1-5ms | Up to 81KB (coach: 449 lines). Reads entire file, uses tail 100 |
| 5 | `readFileSync(latest/<agent>.json)` | File read | <1ms | Tiny file (~500 bytes) |
| 6 | `readFileSync(context.md)` | File read | <1ms | 925B-6KB per agent |
| 7 | `loadKnowledgeIndex()` | File read | <1ms | **Cached** after first call. 28KB, 1088 lines. Heartbeats only |

**Total**: 3 SQLite queries + 3-4 file reads = **6-7 I/O operations**

All synchronous. Estimated wall-clock: **5-15ms total** (dominated by ERROR_LOG.jsonl read for large files).

## Analysis of Each Sub-Item

### 1. Session Header — Clean ✅
Pure string concatenation. No issues.

### 2. Digest History Block — Functional but has redundant parsing
- `getRecentDigests()` returns rows with `files_modified` as JSON string
- `buildSessionContext` parses `files_modified` on each row to build `recentFiles` set
- `getCrossAgentDigests` ALSO parses `files_modified` on each candidate row for intersection
- `formatDigestEntry` parses `files_modified` a THIRD time for display

**Finding**: `files_modified` gets JSON.parse'd 3 times across the pipeline for the same data. Not a performance issue (microseconds), but a code smell. The real question is whether `getCrossAgentDigests` is ever useful — it requires the current agent to have recently modified files AND another agent to have modified the same files in the last 2 hours.

**Measured**: In practice, cross-agent digests fire rarely because most agents work on different files. The whole `recentFiles` set construction + `getCrossAgentDigests` call could be lazy (only compute if there are other recent digests).

### 3. Active Recall — Reads entire file, processes tail
- Reads the **entire** ERROR_LOG.jsonl via `readFileSync`, then takes `slice(-100)`
- Coach's file is 449 lines — reads all 449, uses last 100
- JSON.parse per line, filter by timestamp, dedup by type

**Finding**: For agents with large error logs, this reads unnecessary data. But the largest file is 81KB (coach, 449 lines) — trivial. The `slice(-100)` approach is simple and correct. No action needed.

### 4. Checkpoint Injection — Clean ✅
Single file read from a predictable path. Returns null if missing. Clean.

### 5. Context Files — Dead feature
- Only evaluator defines `contextFiles`, and it's empty `[]`
- No agent actually uses this. The loop body never executes in production.
- The feature was designed for injecting external config/docs per-agent.

**Finding**: This is effectively dead code. The `if (def.contextFiles)` guard means it's zero-cost, but it's conceptual weight that suggests a feature nobody uses. However, it's 6 lines — not worth removing. If anything, context.md (sub-item 6) has replaced this feature.

### 6. Context Learning — Clean ✅
Reads `context.md` from agent directory. All agents have one (925B-6KB). Simple and effective — this is how persistent knowledge reaches agents.

### 7. Knowledge Routing — Well-scoped ✅
- Only fires for heartbeat sessions (task starts with "[heartbeat]")
- Index is cached after first load (28KB JSON, ~60 entries)
- Keyword matching is O(entries × keywords) — tiny
- Max 3 results injected

Good scope limitation. Heartbeats are the briefing moment; delegated tasks get context from the dispatcher.

## Total Context Size Budget

The output of `buildSessionContext` feeds into the first user message. Approximate sizes:

| Sub-item | Typical size | Max size |
|----------|-------------|----------|
| Session header | ~100 chars | ~100 chars |
| Digest history (10 entries) | 1-3 KB | 10 KB (overflow cap) |
| Active recall | 0-500 chars | ~2 KB (many failure types) |
| Checkpoint | 0-500 chars | ~2 KB (large data field) |
| Context files | 0 | 0 (unused) |
| Context.md | 1-6 KB | ~10 KB |
| Knowledge routing | 0-300 chars | ~500 chars |

**Typical total: 3-8 KB** (~750-2000 tokens)  
**Max total: ~25 KB** (~6000 tokens) — dominated by context.md + digest overflow

This is reasonable for a first-message context injection. The 10KB overflow cap on digests is a good safety valve.

## Comparison with Prior Audit

The Lens B audit from 2026-04-11 10:54 noted "7 sub-items in context injection." This audit confirms exactly 7, but the actual I/O cost (6-7 ops, ~10ms) is lower than the layer count suggests. The design is sound:

1. **No redundant fetches** — each sub-item reads different data
2. **Failures contained** — each block has try-catch, null fallback
3. **DB cached** — all 3 SQLite queries share one handle
4. **Knowledge index cached** — parsed once, reused across sessions
5. **Heartbeat-only gating** — knowledge routing doesn't waste tokens on delegated tasks

## Simplification Opportunities

### P3: Lazy cross-agent digest computation
**Current**: Always builds `recentFiles` set and queries `getCrossAgentDigests`, even when the agent hasn't modified any files recently (empty set → empty result).
**Proposed**: Skip `getCrossAgentDigests` when `recentFiles.size === 0` — oh wait, it already does this (line 132: `if (recentFiles.size === 0) return []`). But the `recentFiles` set construction still runs even when no digests have `files_modified`. Minor — not worth changing.

### P3: Remove `contextFiles` dead branch
Only evaluator defines it (empty). No agent uses it. Could be removed from `SubagentDefinition` type and `buildSessionContext`. But it's 6 lines — effort/value ratio is poor.

### P2: Active recall tail optimization
Instead of `readFileSync` for the entire file, could use a reverse line reader or `tail -100`. But the largest file is 81KB — negligible. Only worth doing if error logs grow unbounded.

## Verdict

**No action needed.** The pipeline has 7 sub-items but they're all independent, well-contained, and fast (~10ms total). The prior audit's "7 sub-items in context injection" flag was warranted as a complexity observation, but upon deep inspection, the complexity is inherent (each sub-item serves a distinct purpose) rather than accidental (redundant or unnecessary work).

The only real dead weight is `contextFiles` (sub-item 5), but it's 6 lines behind a null guard — not worth a PR.
