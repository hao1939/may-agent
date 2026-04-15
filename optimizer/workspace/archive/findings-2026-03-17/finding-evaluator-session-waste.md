# Finding: Evaluator Session Waste — Duplicate Triggers + Cascade

**Date:** 2026-03-17T22:50
**Severity:** Medium — ~$5-8/day waste from redundant evaluator sessions

## Evidence

In the last 4 hours: **33 evaluator sessions** (8/hour), 73% with ≤3 ops.

### Three evaluation triggers exist (overlapping):

| Cron Entry | Type | Interval | What it does |
|---|---|---|---|
| `evaluate-sessions` | JS handler | 30min | Skips trivial sessions, then calls `evaluateTask()` which spawns LLM child sessions for each parent |
| `evaluate-session-llm` | run-agent-task | 45min | Evaluator agent evaluates ONE session via LLM |
| `heartbeat-evaluator` | heartbeat | 2h | Calibration, criteria evolution (not evaluation) |

### Breakdown of 33 sessions:
- **24 "Task Tree Evaluation" child sessions** — spawned by JS handler, most 0-2 ops
- **3 "[cron:evaluate-session]" sessions** — from `evaluate-session-llm` cron
- **2 "[heartbeat]" sessions** — normal
- **6 "Your previous response..." retry sessions** — JSON parse failures, follow-up attempts

### Root causes:

1. **Duplicate LLM evaluation**: `evaluate-sessions` handler already calls `evaluateTask()` which spawns LLM evaluator sessions. The `evaluate-session-llm` cron is redundant — it evaluates sessions that the handler would already pick up.

2. **Cascade**: When many sessions are unevaluated (e.g., bob has 14 error sessions), the handler spawns many child sessions in one run, flooding the system.

3. **Retry waste**: When evaluator fails to output valid JSON (~18% of sessions), a retry session is spawned, doubling cost for that evaluation.

4. **Coach trigger cascade**: `evaluate-sessions` handler triggers `heartbeat-coach` on `needs_improvement` verdicts, creating more sessions.

## Proposed Fix

### Immediate (disable duplicate):
Disable `evaluate-session-llm` cron entry in `cron.json`. The JS handler already handles LLM evaluation.

**Savings**: ~2 evaluator sessions/hour × $0.10/session ≈ $4.80/day

### Medium-term (limit cascade):
Modify `handleEvaluateSessions()` to evaluate at most 2 parent trees per run (currently evaluates ALL unevaluated parents). This prevents cascade when many sessions are pending.

### Medium-term (reduce retries):
The "Your previous response did not contain valid JSON" retries indicate the evaluation prompt needs better structured-output enforcement or a JSON schema constraint.

## Impact
- Saves ~15-20 evaluator sessions/day
- Reduces evaluator from 33 sessions/4h to ~10 sessions/4h
- Reduces cascade into coach heartbeats
