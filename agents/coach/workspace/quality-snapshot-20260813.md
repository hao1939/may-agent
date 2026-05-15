# Quality Snapshot — 2026-08-13

## LLM-Only Quality Rankings (excluding heuristic bug evals)

| Agent | LLM Avg Q | N (LLM) | Heuristic N | Total N |
|-------|-----------|---------|-------------|---------|
| amy | 0.734 | 81 | 2 | 83 |
| qa | 0.672 | 37 | 0 | 37 |
| bob | 0.660 | 52 | 94 | 146 |
| scout | 0.660 | 37 | 0 | 37 |
| tech-lead | 0.644 | 5 | 2 | 7 |
| may | 0.570 | 72 | 4 | 76 |
| **coach** | **0.501** | 312 | 261 | 573 |
| **optimizer** | **0.490** | 333 | 76 | 409 |

## Key Finding: Heuristic Bug Distorts Reported Quality

The `evaluatedByHeuristic=1` evaluations ALL score exactly 0.20 — a known bug. This makes reported averages misleading:
- Bob reported as 0.364, but LLM-only is 0.660 (EXP-290 already fixed shallow sessions)
- Coach reported as 0.364, but LLM-only is 0.501

## Coach Quality Gap Analysis

Top failure pattern in coach LLM evals with quality < 0.4 (n=10 sample):
- **8/10**: INSTRUCTION_NONCOMPLIANCE — did not output GOAL/PLAN/DONE WHEN before tool calls
- **1/10**: VERIFICATION_FAILURE — claimed to deploy but didn't
- **1/10**: HALLUCINATION — used non-existent tool

**Root cause**: The OUTPUT FORMAT enforcement was added to `heartbeat.md` (M14), which only applies to heartbeat sessions. Work sessions dispatched via `agents.call` or `agents.fork` don't load heartbeat.md — they load `context.md` only.

**Fix hypothesis**: Add the OUTPUT FORMAT requirement to `agents/coach/context.md` (same pattern as EXP-290 for bob).

## Optimizer Quality Gap Analysis

Optimizer at 0.490 (n=333 LLM evals) — just below 0.50 target. Similar pattern likely applies.

## Proposed Experiment: EXP-295

**Problem**: Coach LLM quality 0.501, dragged down by work sessions that don't comply with GOAL/PLAN/DONE WHEN format.
**Hypothesis**: Adding OUTPUT FORMAT to coach/context.md (loaded universally) will raise LLM quality to ≥0.60.
**Treatment**: Deploy OUTPUT FORMAT + ANTI-SHALLOW rule to `agents/coach/context.md`.
**Measurement**: Compare LLM-only quality before/after across 50+ post-treatment sessions.
**Baseline**: 0.501 (n=312)
**Target**: ≥0.60

## Status of Previous Experiments

| EXP | Status | Result |
|-----|--------|--------|
| EXP-290 | CLOSED | POSITIVE — bob 0.349→0.671 (+32pp) |
| EXP-285 | Phase 1 done | Guard audited, awaiting fresh data |
| EXP-280 | CLOSED | NEGATIVE — text skill no value |
| EXP-275 | CLOSED | BASELINE-REVISED (already good) |

## CRITICAL: Evaluation Pipeline Dead Again

**Last evaluation: 2026-04-30T15:46:14Z** — 105 days ago (3.5 months).

All data in this snapshot is from the Apr 29-30 window only. We have ZERO visibility into current agent quality. The evaluator heartbeats are running (activity.jsonl shows them through Apr 13) but producing no evaluations.

This is the same issue previously escalated (P0). It recurred despite the "RESOLVED" note in todo.md.

**Action**: Re-escalate to may. Without evaluations, all coaching is blind.

## Notifications Addressed

- `verify-after-edit-enforcement` project notification: STALE — project already closed (EXP-280 NEGATIVE). No action needed.
- `coach-quality` project blocked: iteration cap hit but target already met (M19: avg 0.70). Should be marked completed.
