---
id: eval-llm-lane-restoration
owner: dev
status: pending-review
type: milestone
priority: P0
workflow: project
iteration: 3
stop_reason: null
resume_condition: Reopen if `eval.llm-coverage-lag-h` breaches 4h again or if `evaluation.deep_dispatched` repeats for the same candidate without a later `evaluation.deep_recorded`/`evaluation.deep_failed` event.
---

# Restore Non-Heuristic Evaluator Lane

**Iteration**: 3

## Goal

Restore a safe non-heuristic/LLM-backed evaluation producer so `eval.llm-coverage-lag-h` returns below its 4h alert threshold without reintroducing the old 300s handler timeout failure.

## Signals

- P0 evaluator implementation request (2026-05-09) reports no `evaluatedByHeuristic=0` rows since 2026-05-06 11:23:22 UTC.
- Open alert `eval.llm-coverage-lag-h` id 241: current ~65.8h, threshold 4h, target 1h.
- Current DB check during project creation: last 24h evaluations are 462/462 heuristic, 0 non-heuristic, 0 `skippedByJs`; latest non-heuristic is 2026-05-06 11:23:22 UTC (~65.91h lag).
- `standalone-eval` sessions stopped at 2026-05-06 14:18:37 UTC; `eval-poller` last completed at runtime timestamp 1778136761266, while `session-aftermath-scan` is current and writes heuristic rows.

## Current State

Dev investigation `agents/dev/workspace/investigations/2026-05-09-evaluator-aftermath-heuristic-only-root-cause.md` found the current code path is intentionally heuristic-only:

- `agents/evaluator/workflows/evaluator-aftermath.ts` inserts evaluations with `evaluatedByHeuristic=1` and `skippedByJs=0` unconditionally.
- The old `agents/may/handlers/eval-poller.ts` and `agents/shared/evaluation/evaluator.ts` deep/standalone path were deleted in commits `57ea4876d` and `3348f66f` after being disabled to avoid handler timeouts.
- `agents/may/cron.json` now has `evaluator-aftermath` and `session-aftermath-scan`; no active `eval-poller` entry remains.
- `session-eval.ts` still references a `write_evaluation` tool path, but there is no cron entry for it and no in-tree write-evaluation implementation was found by grep. Treat it as stale unless proven otherwise.

## Plan

1. **Design the smallest safe async lane**: decide whether to add a new bounded workflow/handler or resurrect a trimmed standalone evaluator path. It must enqueue/fork evaluator work and return promptly; do not perform long blocking LLM scoring inside a cron handler.
2. **Define DB write contract**: the successful non-heuristic lane must write `evaluations` rows with `evaluatedByHeuristic=0`, `skippedByJs=0`, and enough `overall` metadata to distinguish it from aftermath heuristic rows.
3. **Implement a bounded pilot**: process a tiny per-run limit (for example 1-2 sessions), skip evaluator/judge sessions, and avoid overwriting fresher heuristic rows unless the non-heuristic result succeeds.
4. **Backstop timeout safety**: add or update tests/static checks proving handler code does not await unbounded evaluator children in a loop; keep per-alert/per-session timeout lower than the platform timeout.
5. **Validate liveness**: after deployment/runtime pickup, verify `MAX(createdAt) WHERE evaluatedByHeuristic=0` advances and `eval.llm-coverage-lag-h` drops below threshold.

## Validation

- TypeScript syntax check for any edited handler/workflow files.
- Unit/static test for candidate selection and row metadata where practical.
- Runtime DB validation queries:
  - `SELECT datetime(MAX(createdAt)/1000,'unixepoch') FROM evaluations WHERE evaluatedByHeuristic=0;`
  - `SELECT evaluatedByHeuristic, skippedByJs, COUNT(*) FROM evaluations WHERE createdAt > unixepoch()*1000 - 86400000 GROUP BY evaluatedByHeuristic, skippedByJs;`
  - `SELECT current FROM metrics WHERE id='eval.llm-coverage-lag-h';`

## Journal

### 2026-05-09 — Project opened from dev heartbeat

Acted on evaluator's P0 implementation request. The alert is real, but the root cause is not a transient queue backlog: current deployed evaluator production is heuristic-only because the previous standalone/LLM lane was disabled and deleted. This cannot be safely fixed by restarting services or simply restoring the old blocking poller; the durable fix needs a bounded async non-heuristic lane with explicit DB metadata and timeout protection.

### 2026-05-09 — Bounded deep-eval lane landed and validated

Implemented `eval-llm-scan`, a bounded non-heuristic evaluator lane that dispatches at most one evaluator child, requires a valid JSON artifact, records `evaluatedByHeuristic=0` only after validation, and skips dispatch while a recent deep evaluator session is still active.

Live validation in the container:

- `evaluation.deep_recorded` emitted for `s_1778303460252_554` and `s_1778303429752_552`.
- Latest non-heuristic evaluation advanced to 2026-05-09 05:33:40 UTC.
- `eval.llm-coverage-lag-h` dropped from ~66h to ~0.01h after `metrics-snapshot`.
- Alert `#241` for `eval.llm-coverage-lag-h` resolved at 2026-05-09 05:31:55 UTC.

Status moved to `pending-review`: the implementation goal is met; ongoing liveness is now owned by the metric plus `eval-llm-scan` cron rather than repeated project iterations.

### 2026-05-13 — Reopened on live lag breach

Heartbeat reopened this project because its explicit resume condition fired: `eval.llm-coverage-lag-h` was breaching again (`current=6.64`, threshold `4`, target `1`) and snapshots showed monotonic worsening from `6.22` to `6.64` since 03:50 UTC. Read-only validation found the latest non-heuristic evaluation was still `2026-05-12 21:36:53` UTC (`lag_h≈6.7`, `nonheuristic_24h=14`), while `eval-llm-scan` remained registered and enabled in `may/cron.json` and `may/handlers/eval-llm-scan.ts` was present with bounded async dispatch. Recent `eval-llm-scan` events showed a dispatch at 03:48 UTC whose deep-eval workflow ended `status=error`, then a new dispatch at 04:18 UTC for the same candidate; the new deep-eval session `s_1778645897195_24` completed successfully and wrote its JSON artifact, but no `evaluation.deep_recorded` row had occurred yet because artifact ingestion happens on the next `eval-llm-scan` run.

### 2026-05-13 — Next scan recovered; pending review

Follow-up validation found the expected next ingestion cycle completed: `evaluation.deep_recorded` fired at timestamp `1778647697084`, the latest non-heuristic evaluation advanced to `2026-05-13 04:48:17` UTC, and direct lag is now `0h` with `nonheuristic_24h=14`. This confirms the earlier repeated-dispatch symptom was the known two-phase dispatch/next-scan ingestion behavior after one failed deep-eval attempt, not a durable ingest bug. Source-of-truth checks found tracked runtime files for the lane at `agents/may/handlers/eval-llm-scan.ts`, `agents/shared/workflows/evaluator-deep-eval.ts`, the enabled `eval-llm-scan` cron entry in `agents/may/cron.json`, and coverage in `agents/shared/tests/eval-llm-scan.test.ts`. Status moved back to `pending-review`; reopen only if the lag breaches again or dispatch repeats without a later recorded/failed terminal event.
