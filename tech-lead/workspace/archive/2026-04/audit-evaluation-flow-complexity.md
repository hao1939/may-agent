# Audit: Evaluation System Flow Complexity

**Date**: 2026-04-12  
**Lens**: B (Flow Complexity)  
**Status**: COMPLETE — **ACTION TAKEN**: Paths 2-3 removed (see `cleanup-evaluation-dead-weight.md`)  
**Builds on**: Lens A audit (`audit-evaluation-architecture.md`)

## Flow Trace: From Session Completion to Evaluation Persisted

### The Happy Path (should be simple)

A session completes → an evaluation is written to `evaluations` table in may.db.

That's 1 input, 1 output. Let's count the layers it actually passes through.

---

## Path 1: LLM Evaluation (`evaluateTask`)

**Trigger chain** (7 layers):
1. `runAgentWithRetry()` in manager.ts → agent loop ends
2. `handleCompletion(session)` callback fires  
3. `handleCompletionInner()` → `detectErrors()`, `clearPostFinishErrors()`, `detectShallowHeartbeat()`, `determineOutcome()`, `cleanupSession()`, `buildSessionInfo()`
4. `this.emit({ type: "session_end", ... })` emitted on bus
5. `bus.subscribe()` in may.ts (line ~438) receives event
6. **Guard**: checks `info.parentSessionId === taskSessionId` — only fires for children of the current interactive task
7. `setTimeout(async () => { evaluateTask(...) }, 3000)` — 3-second delay

**Inside `evaluateTask()`** (8 more layers):
1. `manager.registryStore.getRegistry().sessions` — read all sessions from registry
2. `findUnevaluatedChildren()` — filter to unevaluated children of parent
3. `hasEvaluation()` per child — file-system check
4. `readSessionMessages()` per child — load full transcript
5. `extractFailureChains()` + `extractUsage()` + `formatTranscript()` per child — analysis
6. `buildEvalPrompt()` — construct LLM prompt
7. `manager.run("evaluator", prompt)` + `manager.waitFor(evalSessionId)` — run evaluator agent
8. `parseTaskEvaluation(responseText)` — parse LLM output to structured result

**After `evaluateTask()` returns** (may.ts line ~453):
1. For each evaluated sessionId, `upsertEvaluation()` is called
2. `getDb(persistDir)` opens/reuses shared DB connection
3. SQL `INSERT OR REPLACE INTO evaluations`
4. `bus.emit({ type: "context-learn", ... })` — triggers separate context learning flow

**Total layers**: ~19 hops from session end to evaluation persisted.

**Unnecessary indirection found**:
- `buildSessionInfo()` converts from `ActiveSession` to a plain info object, which the bus subscriber immediately destructures back. The bus event carries a flat data object that maps nearly 1:1 to what `handleCompletionInner` already has.
- The 3-second `setTimeout` is undocumented — purpose unclear (giving other subscribers time? avoiding concurrent evaluations?).
- `findUnevaluatedChildren()` walks the ENTIRE registry (19K+ sessions) to find children of one parent. No index by `parentSessionId`.

---

## Path 2: Skipped Evaluations (`writeSkippedEvaluations`)

**Trigger**: Called once at startup in may.ts (line ~543), fire-and-forget `.then()`

**Flow** (5 layers):
1. `loadAllSessionMetasAsync(persistDir)` — reads ALL session meta.json files (19K+)
2. For each session, checks `hasEvaluation(persistDir, sessionId)` — file-system read
3. Filters: `skipAgents.has(session.agent)` or `findSessionJsonl()` returns null
4. `upsertEvaluation()` → `getDb(persistDir)` → SQL INSERT

**Second pass** (orphaned sessions, 3 more layers):
5. `listActiveSessionIdsAsync()` + `listArchivedSessionIdsAsync()` — directory listings
6. Filters IDs not in `knownSessionIds`
7. `upsertEvaluation()` again

**Total layers**: ~8, but the I/O is massive (19K+ file reads at startup).

**Unnecessary indirection**:
- Reads 19K+ meta.json files from disk when the sessions table already has the same data in SQLite.
- `hasEvaluation()` does a file-system existence check when evaluations are in SQLite.
- The orphan pass does TWO directory listings when it could just query the DB.

---

## Path 3: Heuristic Evaluations (`writeHeuristicEvaluations`)

**Trigger**: Called once at startup in may.ts (line ~551), fire-and-forget `.then()`

**Flow** (7 layers):
1. `loadAllSessionMetasAsync(persistDir)` — SAME 19K+ file read as Path 2 (runs independently, reads all files again)
2. Filter: `session.parentSessionId` → skip children (root sessions only)
3. `getEvaluationStatus(persistDir, sessionId)` — checks existing eval + usage data
4. `findSessionJsonl(persistDir, sessionId)` — locate transcript file
5. `readFileSync(transcriptPath)` — read full transcript
6. Parse all lines to `AgentMessage[]`
7. `computeHeuristicScores(session, transcriptText, messages)` — 400+ lines of heuristic logic

**Inside `computeHeuristicScores`** (12 sub-analyses!):
1. Count tool calls from transcript
2. Count assistant turns  
3. `extractFinishCallParams(messages)` — find and parse finish() calls
4. Session status classification (error vs done vs interrupted)
5. Shallow session detection
6. finish() status differentiation (success/partial/failure/blocked)
7. Semantic quality signals (hollow summary, deliverables, evidence quality)
8. Verification effort bonus (bash command analysis for test runners)
9. Proxy-satisfying behavior detection (6 regex patterns across summary + last 3 messages)
10. Behavioral frustration detection (`detectFrustrationSignals()` — another multi-step analysis)
11. Hard error counting (tool failures in short messages only)
12. Waste ratio penalty

Then: `extractUsage(messages)` → `upsertEvaluation()` → SQL INSERT

**Total layers**: ~20+ internal operations per session evaluation.

**Unnecessary indirection**:
- `computeHeuristicScores` is 400+ lines with 12 sub-analyses. Yet `evaluation-sync` (Path 4) reimplements the same concept in ~40 lines with much coarser logic. Two different implementations, same purpose.
- Reads FULL transcripts (can be megabytes each) for pattern matching, when most signals could be extracted from structured metadata.
- `loadAllSessionMetasAsync` is called AGAIN (separate from Path 2's call). Two separate full-directory scans at startup.

---

## Path 4: Evaluation-Sync Cron Handler

**Trigger**: Cron job, 10-minute interval, registered at agent-loader startup.

**Flow** (6 layers):
1. Open own `Database` connection (WAL-safe)
2. Query `evaluations` table for already-evaluated IDs
3. Query `sessions` table for done/error/interrupted sessions
4. Filter unevaluated
5. For each (max 50): find session dir, load meta.json, `computeEvaluation()`, `loadSessionUsage()`
6. SQL INSERT via prepared statement in transaction

**Inside `computeEvaluation`** (4 sub-analyses):
1. Agent type check (evaluator → skip)
2. Status check (0-op interrupted → skip)
3. `countToolCalls()` — read session.jsonl, count productive vs wasted
4. Score computation (error/shallow/waste-ratio)

**Total layers**: ~10, clean and efficient.

**This is the simplest path** — but it has the crudest scoring logic.

---

## Flow Comparison Table

| Dimension | Path 1 (LLM) | Path 2 (Skip) | Path 3 (Heuristic) | Path 4 (Sync) |
|-----------|---------------|----------------|---------------------|---------------|
| Trigger | event-driven | startup once | startup once | cron 10min |
| Layers to persist | ~19 | ~8 | ~20 | ~10 |
| File I/O | transcript only | 19K metas | 19K metas + transcripts | per-session |
| DB connection | shared (WAL risk) | shared (WAL risk) | shared (WAL risk) | own (safe) |
| Scoring depth | LLM (full) | none (skip) | 12 sub-analyses | 4 sub-analyses |
| Scope | children only | meta agents/orphans | root sessions | any unevaluated |
| Status | working, rare | working | working | enabled, working |

---

## Key Complexity Issues

### Issue 1: Double Full-Directory Scan at Startup
Paths 2 and 3 both call `loadAllSessionMetasAsync(persistDir)` independently. Each reads 19K+ meta.json files from disk. **This is ~38K file reads at every startup** for data that already exists in the sessions SQLite table.

**Fix**: Both should query the sessions table instead of scanning the filesystem. Path 4 already does this correctly.

### Issue 2: Two Incompatible Heuristic Scoring Implementations
`computeHeuristicScores()` (Path 3, ~400 lines) and `computeEvaluation()` (Path 4, ~80 lines) both score sessions heuristically but produce different results:

| Scenario | Path 3 Score | Path 4 Score |
|----------|-------------|-------------|
| Done session, 10 tool calls, 0 errors | Q:0.7, E:0.7 | Q:1.0, E:0.8 |
| Error session | Q:0.3 | Q:0.1 |
| Done + finish(success) + verified | Q:0.9+ | Q:1.0 |
| Done + proxy-satisfying detected | Q:0.1-0.3 | Q:1.0 (can't detect) |

Path 3 has sophisticated detection (proxy-satisfying, frustration, hollow summaries) that Path 4 completely lacks. Path 4 is just status + waste ratio.

**If Path 4 replaces Path 3 (as Lens A proposes), scoring quality degrades dramatically.**

### Issue 3: The `findUnevaluatedChildren()` Full-Registry Walk
Path 1 calls `findUnevaluatedChildren()` on every `session_end` event for task children. This function iterates ALL 19K+ entries in `registry.sessions` to find children of one parent. With ~100+ sessions completing per hour, this is ~1.9M object checks per hour.

**Fix**: The registry should index sessions by `parentSessionId`, or `findUnevaluatedChildren` should use the SQLite `sessions` table with a `WHERE parentSessionId = ?` query.

### Issue 4: Shared DB Connection Risk (Paths 1, 2, 3)
Lens A identified the WAL persistence bug. Paths 1, 2, and 3 all use the shared `getDb(persistDir)` connection. Path 4 was specifically created to avoid this. Yet the startup functions (2, 3) and the event-driven evaluator (1) still use the shared connection.

**Why this matters for flow**: If the process crashes before WAL checkpoint, evaluations from Paths 1-3 are lost. Path 4 checkpoints on close. This means the same session could be:
- Evaluated by Path 3 at startup → stored in WAL
- Re-evaluated by Path 4 at next cron tick → stored persistently
- Both claim to be authoritative → data inconsistency

### Issue 5: The 3-Second setTimeout in Path 1
```typescript
setTimeout(async () => {
    try {
      const result = await evaluateTask({...});
```
This delay is undocumented. It appears to be a race condition workaround — giving time for the session's data to be fully persisted before the evaluator reads it. But `handleCompletionInner` already calls `cleanupSession()` which writes meta.json before emitting `session_end`. The delay is likely unnecessary and adds latency.

### Issue 6: Context Learning Triggered from Evaluation
Path 1 triggers `context-learn` events after evaluation. This couples evaluation completion to a separate learning pipeline. If context learning fails (LLM error, file permission), it doesn't break evaluation — but it adds another async chain hanging off the evaluation flow. The coupling creates a hidden dependency graph:

```
session_end → evaluateTask → [for each session] → context-learn → learnFromSessionLLM → manager.run("evaluator")
```

So a single session_end can trigger the evaluator agent TWICE: once for the evaluation, once for context learning. Each is an LLM call.

---

## Where Agents Get Confused

### Agent confusion point 1: "Was my session evaluated?"
An agent calling `finish()` has no signal about whether its session will be evaluated by LLM (Path 1), heuristic (Path 3), sync (Path 4), or skipped (Path 2). The evaluation path depends on:
- Is it a child of the current `taskSessionId`? → Path 1
- Is it a root session? → Path 3 (at next startup) or Path 4 (at next cron)
- Is it an evaluator session? → Path 2

No agent has visibility into this routing.

### Agent confusion point 2: Overlapping evaluation writes
A session can be evaluated by BOTH Path 3 and Path 4 if:
1. Startup runs → Path 3 evaluates via shared connection (in WAL)
2. Path 4 cron fires → queries its own connection (doesn't see WAL data) → re-evaluates
3. WAL checkpoints → both evaluations exist, Path 4's `INSERT OR REPLACE` wins

The final score depends on which path wrote last, not which had better analysis.

### Agent confusion point 3: Heuristic inflation
Path 4 gives most done sessions Q:1.0, E:0.8 ("good"). Path 3 gives the same sessions Q:0.5-0.7 with nuanced issue flags. If an agent or dashboard queries evaluations, the score depends on which path evaluated the session. There's no `evaluationMethod` field to distinguish (though `evaluatedByHeuristic` and `skippedByJs` flags exist, they don't distinguish Path 3 from Path 4).

---

## Consolidation Recommendation (Updated from Lens A)

Lens A proposed keeping Paths 1 and 4 and removing Paths 2 and 3. Having now traced the flow in detail, I **partially agree but with a critical addition**:

### Keep:
1. **Path 1 (`evaluateTask`)** — LLM evaluation for task-tree children. Fix the `findUnevaluatedChildren` full-registry walk.
2. **Path 4 (`evaluation-sync`)** — cron-driven heuristic evaluation for everything else. BUT: **port Path 3's sophisticated scoring logic into Path 4's handler**. The current Path 4 scoring is too crude (done=1.0, error=0.1 — no nuance).

### Remove:
3. **Path 2 (`writeSkippedEvaluations`)** — Path 4 already handles skip logic
4. **Path 3 (`writeHeuristicEvaluations`)** — After porting its scoring to Path 4

### Additional fixes:
5. **Kill the double `loadAllSessionMetasAsync` calls** — saves 38K file reads at startup
6. **Add `parentSessionId` index** to registry or use SQL query in `findUnevaluatedChildren`
7. **Remove the undocumented 3s setTimeout** in the evaluation event handler
8. **Add `evaluationPath` field** to evaluations table so downstream consumers know which path scored the session

### Estimated complexity reduction:
- **Layers**: From 4 paths (~57 total layers) to 2 paths (~29 total layers) = ~49% reduction
- **Startup I/O**: From 38K+ file reads to 0 = startup time improvement
- **Code**: ~400 lines of `computeHeuristicScores` moved to evaluation-sync (not deleted — consolidated)
- **Scoring consistency**: One heuristic scorer, not two with different outputs

---

## Summary

The evaluation system has 4 overlapping paths with 57+ total layers of indirection. The core complexity issue isn't the number of paths — it's that paths 3 and 4 are **independent reimplementations of the same logic with incompatible scoring**, and paths 2 and 3 use an I/O pattern (full filesystem scan) when the data already exists in SQLite. 

The system works but is fragile to process crashes (WAL bug), wasteful at startup (38K file reads), and produces inconsistent scores depending on which path evaluates a session.
