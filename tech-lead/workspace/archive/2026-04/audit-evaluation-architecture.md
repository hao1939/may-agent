# Audit: Evaluation System Architecture

**Date**: 2026-04-12  
**Lens**: A (System Architecture)  
**Status**: COMPLETE

## Architecture Map: 4 Evaluation Paths

The evaluation system has **4 separate paths** that write to the `evaluations` table in may.db. Here's how they relate:

### Path 1: `evaluateTask()` — LLM evaluator (real-time)
- **Trigger**: `session_end` event in may.ts, only when `parentSessionId === taskSessionId`
- **Scope**: Children of the current interactive root task session only
- **Method**: Sends full transcript to LLM (evaluator agent model: gpt52)
- **Scale**: 0.0–1.0
- **Coverage**: Only child sessions (~1,518/19,317 = 7.8% of all sessions)
- **Cost**: LLM tokens per eval
- **Last run**: 2026-04-10 (~2 days ago)
- **Status**: Working but rarely fires — most sessions are cron/heartbeat (root sessions)

### Path 2: `writeSkippedEvaluations()` — startup sweep (one-shot)
- **Trigger**: Called once at may.ts startup (line 543)
- **Scope**: Meta-agent sessions (evaluator) and sessions with no transcript
- **Method**: Pure JS, marks as `skipped`
- **Scale**: N/A (scores are 0/0)
- **Coverage**: ~2,540 total (12.6%)
- **Cost**: Zero LLM cost
- **Status**: Working fine

### Path 3: `writeHeuristicEvaluations()` — startup sweep (one-shot)
- **Trigger**: Called once at may.ts startup (line 551)
- **Scope**: Root sessions only (no parentSessionId), non-evaluator, with transcript
- **Method**: Pure JS, reads transcript to compute heuristic scores
- **Scale**: 0.0–1.0
- **Coverage**: ~15,503 total (77.2%)  
- **Note**: Also back-fills usage data for existing evaluations within 48h
- **Cost**: Zero LLM cost
- **Status**: Working, but ONLY on startup — doesn't run continuously

### Path 4: `evaluation-sync` handler — cron job (periodic catchup)
- **Trigger**: Cron job, **ENABLED** in cron.json (10min interval, 2min offset)
- **Scope**: Any session in `sessions` table not yet in `evaluations` table
- **Method**: Pure JS, uses its own `Database` connection (WAL fix pattern)
- **Scale**: 0.0–1.0
- **Batching**: MAX 50 per run
- **Cost**: Zero LLM cost
- **Status**: **SILENTLY BROKEN** — enabled in cron.json but handler was never registered because handler file was created after process started. See `workspace/audit-evaluation-sync-outage.md` for root cause analysis.
- **Last effective run**: NEVER (0 requests in DB)

### Also exists but DISABLED:
- **`evaluate-session-llm`** cron job: Was an agent-based LLM evaluator that ran the evaluator agent to evaluate one session at a time. Disabled 2026-03-17 as redundant with evaluateTask().

## Current State

| Metric | Value |
|--------|-------|
| Total sessions (done/error/interrupted) | 19,309 |
| Total evaluations | 20,094 |
| Orphan evaluations (no session) | 815 |
| Root sessions | 17,799 (92.2%) |
| Child sessions | 1,518 (7.8%) |
| Heuristic evaluations | 15,503 (77.2%) |
| LLM evaluations | 2,051 (10.2%) |
| Skipped evaluations | 2,540 (12.6%) |
| Last LLM evaluation | 2026-04-10 (~2 days ago) |
| Last heuristic eval | 2026-04-11T23:28 |

## Key Finding: Evaluation coverage is good but architecture is redundant

**4 paths, overlapping scope, 3 different invocation patterns**:
1. `evaluateTask()` — event-driven, real-time, but only for 8% of sessions (task-tree children)
2. `writeSkippedEvaluations()` — startup-only batch, overlaps with evaluation-sync's skip logic
3. `writeHeuristicEvaluations()` — startup-only batch, overlaps with evaluation-sync's heuristic logic
4. `evaluation-sync` handler — cron catchup, disabled but its logic duplicates #2 and #3

**The overlap**: Both `writeHeuristicEvaluations()` and `evaluation-sync` compute the same heuristic scores. Both `writeSkippedEvaluations()` and `evaluation-sync` skip the same sessions. The only reason evaluation-sync exists is because the startup functions use the shared DB connection (WAL persistence bug) while evaluation-sync opens its own.

**The WAL bug context**: The original `evaluate-sessions` handler used `ctx.writeHeuristicEvaluations()` which wrote via the shared WAL connection. Those writes were visible within the handler's connection but never checkpointed to disk. This is why evaluation-sync was created — it opens its own `Database` connection. But functions #2 and #3 (`writeSkippedEvaluations()` and `writeHeuristicEvaluations()`) are called at startup from may.ts's top-level scope, which does use the shared connection via `SubagentManager`. **Are they affected by the WAL bug too?**

## Root Question: Are paths 2 and 3 actually working?

The startup functions call `upsertEvaluation()` which uses the manager's DB connection via `getDb()`. If the WAL bug is still present (writes visible in-process but not persisted to disk), then:
- Paths 2 and 3 work **only during the current process lifetime**
- After restart, their writes are lost
- evaluation-sync (path 4) was the fix for this exact problem

The data shows 624 heuristic evals in the last 24h — these are from the startup functions running when may.ts was last restarted. They persist because the process is still running.

## Consolidation Proposal

**Target: 2 paths (down from 4)**

### Keep:
1. **`evaluateTask()`** — the only path that does LLM evaluation. Keep it for task-tree children.
2. **`evaluation-sync` handler** — re-enable and make it the SOLE heuristic+skip path. It already handles all cases that paths 2 and 3 handle, plus it has its own DB connection (no WAL bug).

### Remove:
3. **`writeSkippedEvaluations()`** — redundant with evaluation-sync's skip logic
4. **`writeHeuristicEvaluations()`** — redundant with evaluation-sync's heuristic logic

### Benefits:
- Removes 2 overlapping code paths (~200 lines in evaluator.ts)
- Removes startup cost of scanning all session metas (`loadAllSessionMetasAsync()` reads 19K+ files)
- evaluation-sync is more robust (own DB connection, batched, cron-driven)
- Clearer mental model: LLM eval = real-time event, heuristic eval = cron catchup

### Risk:
- evaluation-sync was silently disabled. Need to understand WHY it was disabled (2026-04-10) and fix that root cause.
- evaluation-sync limits to 50 per run — fine for steady state but needs burst handling after long outages

## Action Items

1. **P1**: Re-enable evaluation-sync cron entry and verify it runs correctly
2. **P2**: Investigate evaluation-sync disable root cause (noted as "Handler file deleted" but file exists)
3. **P2**: Remove `writeSkippedEvaluations()` and `writeHeuristicEvaluations()` calls from may.ts startup
4. **P3**: Clean up the 815 orphan evaluations (no matching session in sessions table)
