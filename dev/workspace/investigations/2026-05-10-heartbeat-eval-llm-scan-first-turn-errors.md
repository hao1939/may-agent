# Heartbeat Eval LLM Scan First-Turn Errors

## Context

Dev heartbeat had no approved work-queue item and no unresolved metric alerts, but the newest failed session was an `eval-llm-scan` evaluator child (`s_1778450304512_101`) and `session.first-turn-error-count-1h` was at its threshold (`current=1`, threshold `1`). This was worth a bounded liveness check because Dev owns the previously restored non-heuristic evaluator lane.

## Evidence

- Work queue: `agents/shared/work-queue.md` Approved section is empty; all candidate implementation items remain Proposed.
- System alert state: unresolved metric-alert query returned `0` rows, and unmeasured-active-metric query returned `0` rows.
- Core metrics at snapshot `1778450451900`:
  - `session.error-rate-6h=0.0569` (target `0.1`, threshold `0.3`) — healthy.
  - `handler.success-rate=0.9787` (target `0.95`, threshold `0.8`) — healthy.
  - `handler.failed-count=10` at threshold but not breaching with alert op `>`.
  - `session.first-turn-error-count-1h=1` at threshold but not breaching with alert op `>`.
- Recent handler failures are not currently an active alert. Latest rows were either scout KE-integrity guard blocks or older `ResolveMessage` import errors; current `handler.success-rate` remains healthy.
- `eval-llm-scan` 6h status distribution: `13 done`, `2 error`.
- Latest `eval-llm-scan` sessions include `s_1778450304512_101` (`status=error`, `endedAt-startedAt≈1001ms`) followed by successful runs such as `s_1778448506373_83`, `s_1778446694362_70`, and `s_1778444894610_47`.
- Non-heuristic evaluator liveness is still good: latest non-heuristic evaluation is `2026-05-10 21:29:42` UTC, `nonheuristic_24h=31`, `eval.llm-coverage-lag-h=0.52`, and `eval.llm-evals-24h=31`.

## Judgment

The single newest `eval-llm-scan` error looks like a transient first-turn child-session failure, not a lane outage: the lane has 13 successful runs in 6h, the live lag metric is well below its 4h threshold, and 24h non-heuristic volume is far above target. No code change is justified from this one sample.

However, this is a useful watch condition for the pending-review `eval-llm-lane-restoration` project: if `eval-llm-scan` first-turn errors repeat while the lag metric is still green, Dev should add a narrow follow-up metric/proposal for deep-eval child first-turn error rate rather than waiting for full lane lag.

## Dispositions

- Aftermath message for `s_1778448869609_93`: acted. The current heartbeat used canned queries/schema hints; one attempted `evaluations.score` query failed and was immediately corrected using the schema hint (`quality`, `efficiency`, `verdict`, `issues`). The prior session's stored evaluation confirms `verdict=needs_improvement`, `quality=0.55`, issue `schema/query error in transcript`.
- Artifact-gate/session-start echoes: acted by producing this substantive investigation artifact instead of another pure recovery note.
- Blocked project nudge for `finish-blocked-hygiene-reduction`: dismissed/held blocked with fresh evidence. Required split metric rows `session.finish-blocked-uncommitted-count-24h` and `session.finish-blocked-unresolved-count-24h` are still absent from `metrics`; Dev cannot safely perform the runtime DB write.
- `eval-llm-lane-restoration`: keep pending-review. Liveness is healthy despite one child error (`eval.llm-coverage-lag-h=0.52`, `eval.llm-evals-24h=31`).

## Next trigger

Reopen or create follow-up work only if either:

1. `eval.llm-coverage-lag-h` breaches again; or
2. at least 3 `eval-llm-scan` sessions error in a 2h window while non-heuristic lag remains below threshold, indicating hidden child-start fragility that the current lag metric masks.
