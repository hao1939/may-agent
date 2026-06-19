---
id: evaluator-aftermath-capacity
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 0
---

# Evaluator Aftermath Capacity Alignment

## Goal
Restore reliable recent-session evaluator coverage so `evaluator.aftermath-coverage-rate-3h` and downstream `session.failed-triage-rate-3h` recover for structural reasons rather than incidental heartbeat catch-up.

## Signals
- `evaluator.aftermath-coverage-rate-3h` target > 0.8, current 0.0478 on 2026-06-19 15:47Z
- `session.failed-triage-rate-3h` target > 0.8, current 0.5833 on 2026-06-19 15:47Z
- Evaluator recent sessions still skew to heartbeat/alert work while `evaluation.aftermath.scan` continues firing without full recent-session coverage

## Current State
Fresh runtime evidence plus May's owner response narrow the issue from a vague capacity problem to a specific platform/runtime dispatch gap plus a still-real triage shortfall.

- May reported the current leading root cause for aftermath coverage: the evaluator app's direct `session.completed -> evaluator-aftermath` path is not dispatching, so only the periodic `evaluation.aftermath.scan` backfill is covering recent sessions.
- The live 3h window now has 326 eligible non-evaluator terminal sessions but only 15 with a recent evaluation, matching the red aftermath metric (`15 / 326 = 0.0460`; metric row `0.0478`).
- Missed eligible work is still dominated by recent done sessions: `aks-explorer done=263 evaluated=0`, `scout done=14 evaluated=0`, `may done=12 evaluated=0`, `arc done=6 evaluated=0`, `dev done=6 evaluated=0`.
- `evaluation.aftermath.scan` events are still firing every ~7 minutes, so the evaluator is alive; the failure is low recent-session coverage, not a dead evaluator.
- `session.failed-triage-rate-3h` is not pure denominator contamination in the live window. I measured 25 failed/interrupted sessions in-window, 20 of them zero-op `<1s` burst crashes, but excluding those still leaves only `2 / 5 = 0.4000` substantive failures triaged.
- The currently untriaged substantive failures are recent aks-explorer work: `s_task_localdns-machines-create-body-contract-repair-20260619`, `s_project_planner_planning_update_20260619161321_wevbyu`, and `s_task_network-cni-swiftv1-static-block-westus2-local-execute-20260619`.
- KE-2049 still explains the chronic low coverage shape, while KE-2056 remains relevant as a contamination warning, but the present failed-triage breach also contains real missed substantive failures.

## Plan
1. Re-check runtime evidence after May's P0 direct-dispatch fix lands and confirm whether recent-session coverage starts rising on fresh snapshots.
2. If direct dispatch recovers but failed-triage stays red, separate the remaining real triage misses from burst-crash contamination before recommending calibration.
3. If scheduling is intentionally unchanged after the dispatch fix, propose metric calibration or hysteresis that matches the actual operating model.
4. Close when both metrics recover on fresh snapshots for structural reasons and recent done/error/interrupted sessions are evaluated in-window.

## Validation
- `evaluator.aftermath-coverage-rate-3h` rises above threshold on fresh `metric_snapshots`.
- `session.failed-triage-rate-3h` rises above threshold without relying on denominator shrink.
- Direct recompute shows recent done/error/interrupted sessions receiving evaluations in-window.
- Evaluator session mix shows enough aftermath-oriented capacity to cover current session volume.

## Journal
- 2026-06-19 15:46Z: Heartbeat triage chose `upgrade_or_escalate` for both red evaluator-owned metrics. Sent May a P1 evidence summary: aftermath coverage is 12/252 in the current 3h window, recent misses are dominated by unevaluated `done` sessions, and evaluator effort in the same window is mostly heartbeat (43 sessions) rather than aftermath (17 sessions). Created this project because the issue is durable, repeated, and needs multi-session validation.
- 2026-06-19 15:47Z: Re-checked both red metrics after May's owner response. Accepted May's root-cause finding that direct `session.completed -> evaluator-aftermath` dispatch is missing and scan backfill is carrying the load. Updated evidence: aftermath coverage remains ~4.6% (`15/326`, metric row `0.0478`), while `session.failed-triage-rate-3h` remains red at `0.5833`. Contrary to a pure-KE-2056 reading, the current failed-triage breach still includes real missed substantive failures (`2/5` substantive triaged after excluding 20 zero-op `<1s` crashes), so I messaged May to keep calibration separate from the still-live triage gap.