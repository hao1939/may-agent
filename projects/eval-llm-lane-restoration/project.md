---
id: eval-llm-lane-restoration
owner: dev
status: waiting
type: milestone
priority: P0
workflow: project
iteration: 3
stop_reason: all planned restoration/hardening milestones are complete and the project is awaiting May/human review. Resume when: `eval.llm-coverage-lag-h` breaches 4h again, `evaluation.deep_dispatched` repeats w
resume_condition: `eval.llm-coverage-lag-h` breaches 4h again, `evaluation.deep_dispatched` repeats without a later `evaluation.deep_recorded`/`evaluation.deep_failed`, or the reviewer requests a specific follow-up.
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
Waiting: all planned restoration/hardening milestones are complete and the project is awaiting May/human review. Resume when: `eval.llm-coverage-lag-h` breaches 4h again, `evaluation.deep_dispatched` repeats without a later `evaluation.deep_recorded`/`evaluation.deep_failed`, or the reviewer requests a specific follow-up.

- **I believe**: The non-heuristic lane is restored, durable in tracked source, bounded/asynchronous, and currently healthy: `eval.llm-coverage-lag-h.current = 0.04`, threshold `4`, latest non-heuristic evaluation `2026-05-13 04:48:17`, `nonheuristic_24h = 14`.
- **I'm uncertain about**: Long-term recurrence behavior beyond the latest scan/snapshot cycle; the static smoke check exists, but the full runtime-coupled unit test still cannot run in this container because `/app/src` is unavailable.
- **I'd change my mind if**: The smoke test fails, the cron/handler source disappears from tracked files, the metric breaches again, or trace events show dispatches with no eventual recorded/failed terminal event.

## Review answers

1. **Is the goal closer?**  
   Yes. The actual outcome metric is restored below alert threshold: `eval.llm-coverage-lag-h.current = 0.04` against threshold `4`, with a fresh `evaluatedByHeuristic=0` row at `2026-05-13 04:48:17`.

2. **What did we learn?**  
   The source-of-truth discrepancy from iteration 1 is resolved. The lane exists in tracked files: `agents/may/handlers/eval-llm-scan.ts`, `agents/may/cron.json`, `agents/shared/workflows/evaluator-deep-eval.ts`, and tests/smoke checks. The repeated dispatch symptom was explained by two-phase behavior after one failed deep-eval attempt: dispatch occurs first, artifact ingestion/DB write happens on a later scan.

3. **Is the current milestone the right next step?**  
   No further worker milestone is needed right now. The milestones **Design the smallest safe async lane**, **Define DB write contract**, **Implement a bounded pilot**, **Backstop timeout safety**, and **Validate liveness** are complete enough for review.

4. **Are we closing the loop?**  
   Yes. This is no longer just symptom recovery: there is tracked cron registration, bounded async handler behavior, artifact validation before DB writes, trace events, and a static recurrence smoke check at `agents/test/eval-llm-scan-smoke.test.ts`.

5. **Is it verified?**  
   Yes for the review threshold. Evidence:
   - DB metric check shows `eval.llm-coverage-lag-h.current = 0.04`.
   - DB latest non-heuristic check shows `latest_nonheuristic_utc = 2026-05-13 04:48:17`, `nonheuristic_24h = 14`.
   - Worker ran `bun test agents/test/eval-llm-scan-smoke.test.ts` successfully from `/app`.
   - Worker also documented successful smoke execution from `/app/agents`.
   - The remaining full unit test limitation is environmental: it imports missing `/app/src`, not a failure of the lane itself.

6. **What's blocking progress?**  
   No external dependency is blocking implementation. The correct state is waiting for review because the project is already in `pending-review` and the live metric/source/test evidence supports closure.
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


## Artifacts
- outputs/iteration-2-source-of-truth-hardening.md
- outputs/iteration-1-restoration-evidence.md


## Context
- `eval-llm-scan` is the restored non-heuristic evaluator lane and exists in tracked source at `agents/may/handlers/eval-llm-scan.ts`.
- `agents/may/cron.json` contains an enabled `eval-llm-scan` job for agent `evaluator`, interval `1800000`, with bounded handler config.
- The handler dispatches evaluator deep-eval work asynchronously, processes at most one candidate per scan, suppresses recent active deep-eval work, and validates artifacts before writing `evaluatedByHeuristic=0`, `skippedByJs=0` rows.
- Static recurrence smoke coverage exists at `agents/test/eval-llm-scan-smoke.test.ts` and passed in the worker iteration.
- Runtime verification on 2026-05-13 showed `eval.llm-coverage-lag-h.current=0.04`, latest non-heuristic evaluation `2026-05-13 04:48:17`, and `nonheuristic_24h=14`.
- Project is pending review; reopen only if `eval.llm-coverage-lag-h` breaches 4h again or dispatch events repeat without later recorded/failed terminal events.
