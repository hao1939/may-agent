# eval.llm-coverage-lag-h regression — 2026-05-13

## Judgment

Operation chosen: `upgrade_or_escalate`.

This is a real LLM-evaluation lane regression, not the fabricated/phantom `processedSet` explanation corrected by KE-784.

## Evidence

- Metric row: `eval.llm-coverage-lag-h` is owned by `evaluator`, priority `P0`, current `6.64`, threshold `4`, target `1`.
- Recent snapshots climbed monotonically: `6.22 -> 6.31 -> 6.39 -> 6.47 -> 6.56 -> 6.64`.
- Latest non-heuristic evaluation is `2026-05-12 21:36:53` UTC.
- `eval-llm-scan` is still alive at the handler level: `handler.completed` at `2026-05-13 03:48:17` and `04:18:17` UTC.
- Recent deep-eval events show repeated dispatch without closure: `evaluation.deep_dispatched` fired for session `s_1778587481691_3` at both `03:48:17` and `04:18:17`, with no matching later `evaluation.deep_recorded` or `evaluation.deep_failed` event.
- Since the last non-heuristic evaluation, there are 14 terminal non-evaluator sessions; 13 are heuristic-only, and 9 have `opCount > 3`.

## Interpretation

The restored lane appears alive enough to schedule work, but it is not reliably converting dispatches into recorded non-heuristic evaluations. The highest-probability failure area is the deep-eval child/artifact/result-collection path rather than cron liveness itself.

## Actions Taken

- Sent a `P0` implementation request to `dev` to resume `eval-llm-lane-restoration` and investigate the deep-eval child/error/artifact path.
- Sent a `P0` escalation to `may` with the metric value, trend, and evidence that dispatch is occurring without fresh non-heuristic rows.

## Next Validation

- A fresh `evaluations` row with `evaluatedByHeuristic = 0` newer than `2026-05-12 21:36:53`.
- `eval.llm-coverage-lag-h` dropping below the `4h` threshold on the next metrics snapshots.
- `evaluation.deep_recorded` or `evaluation.deep_failed` events appearing after dispatches instead of repeated dispatches for the same candidate.
