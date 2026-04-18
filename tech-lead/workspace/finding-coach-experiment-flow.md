# Finding: Coach Experiment Lifecycle Flow Complexity

**Lens**: B (Flow Complexity)  
**Date**: 2026-04-17  
**Scope**: Full lifecycle of a coach experiment from proposal to completion

## Summary

The coach experiment lifecycle touches **6+ distinct layers** across multiple directories and handler files. The flow is moderately complex but each layer serves a clear purpose. The main concern is not unnecessary indirection but rather **lack of a single orchestration point** — the lifecycle is stitched together by convention (heartbeat instructions + cron handlers) rather than a unified state machine.

## Lifecycle Layers

### 1. Scout Proposal → Coach (2 files)
- **Scout** identifies research opportunities and writes proposals/knowledge entries
- **`agents/may/handlers/research-sync.ts`** syncs experiment artifacts (knowledge entries, hypotheses, experiments) into SQLite via cron
- Proposals reach coach via the request system (`requests` table, `toAgent='coach'`)

### 2. Coach Heartbeat Triage (1 file, 184 lines)
- **`agents/coach/heartbeat.md`** — the dispatch brain. Coach checks pending requests, metrics, experiments, and decides what to fork
- Uses a priority ladder: P0/P1 tasks → active projects → red metrics → self-directed
- Running-session guard prevents duplicate work sessions

### 3. Coach Experiment Execution (3+ files)
- **`agents/coach/workflows/growth-cycle.ts`** (331 lines) — the main experiment workflow: fork agent → apply change → test via gym → record results
- **`agents/coach/workflows/training-sprint.ts`** — batch testing workflow
- **`agents/gym/`** — gym infrastructure (scenarios, lib, results)
- Experiments tracked in `agents/coach/workspace/experiments/EXP-XXX/` (design.md, baselines.md, results.md)
- Also tracked in `agents/coach/experiments.jsonl` (3 entries) and `agents/coach/workspace/results.jsonl`

### 4. Results & Evaluation (2 files)
- **`agents/may/handlers/coaching-report.ts`** (233 lines) — daily summary of agent quality scores, reads evaluation JSON files from `.state/may/evaluations/`
- **`agents/may/handlers/coaching-feedback.ts`** (161 lines) — reads `convention_checks` table, groups violations by agent, sends targeted coaching briefs back to coach

### 5. Experiment State Tracking (scattered)
- `agents/coach/workspace/experiments/` — per-experiment directories (EXP-057 through EXP-088+)
- `agents/shared/knowledge/experiments/` — graduated experiments (EXP-001 through EXP-010+)
- `agents/coach/workspace/experiments.jsonl` — experiment log
- `agents/coach/workspace/results.jsonl` — results log

## Complexity Assessment

**Total files touched in a full lifecycle**: ~8-10 files across 4 directories  
**Total lines of handler code**: ~725 lines (coaching-feedback: 161, coaching-report: 233, growth-cycle: 331)  
**Layers of indirection**: 5 (scout → research-sync → coach heartbeat → workflow → gym → report)

### Severity: LOW

The complexity is **justified** — each layer has a distinct responsibility:
- research-sync: data ingestion (cron, pure JS)
- heartbeat: triage/dispatch (LLM)
- growth-cycle: execution (workflow)
- coaching-report/feedback: observability (cron, pure JS)

### Concern: Experiment state is fragmented

Experiment state lives in 4+ places:
1. `workspace/experiments/EXP-XXX/` (markdown files)
2. `workspace/experiments.jsonl` (log)
3. `workspace/results.jsonl` (results)
4. `shared/knowledge/experiments/` (graduated)
5. SQLite `requests` table (task tracking)

There's no single query to answer "what's the status of EXP-075?" — you'd need to check the workspace directory, the jsonl file, and potentially the requests table.

## Recommended Actions

1. **No immediate action needed** — the flow works and each layer is purposeful
2. **Future consideration**: A lightweight experiment-status index (single file or DB table) that tracks all experiments with their current phase would reduce the fragmentation. Not urgent — current volume (~20 experiments) is manageable.
3. **Not a fix-now item**: The coaching-report handler reads evaluation files from disk (`readdirSync`) rather than querying the `evaluations` DB table. Minor inefficiency, not worth changing now.
