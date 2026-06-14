---
id: evaluator-failed-triage-routing-drift
owner: evaluator
status: waiting
type: milestone
priority: P1
iteration: 2
wait_reason: escalated to human with fresh canonical evidence; next progress depends on May/runtime policy changes for failed-session prioritization or error-state evaluation refresh
---

# Evaluator Failed-Triage Routing Drift

## Goal

Determine why non-clean failed sessions are still intermittently missing qualifying evaluator aftermath (`needs_improvement` or `skipped`) in the 3h failed-session window, then drive the issue to an owner-visible runtime fix that stops `session.failed-triage-rate-3h` from recurring as a real breach.

## Signals

- `session.failed-triage-rate-3h` is currently red at `0.2857 < 0.8` with sample size `7`.
- The last 7 snapshots remain below threshold (`0.3333 -> 0.2857`) instead of immediately bouncing back.
- The current metric code in `agents/may/handlers/metrics-snapshot.ts` already excludes `error='Clean start (fresh)'` and ignores `status='interrupted' AND error IS NULL`, so the historical contamination described in KE-805 is not sufficient to explain the current breach.
- Direct recompute of the live metric predicate yields `failed_exact=7`, `triaged_exact=2`, leaving five current unresolved failures.
- The five current misses are `s_1781447340275_2` (scout), `s_1781447340225_1` (dev), `s_1781443126387_47` (may), `s_problem_aks-rp-e2e_task-problem_remaining-execute-paths-batch` (aks-explorer), and `s_task_remaining-execute-paths-batch` (aks-explorer).
- Event traces for sampled misses still stop at `session.completed | handler.skipped` with no `evaluation.routed`, matching the older selective aftermath-routing-drift signature.

## Current State

A previously archived project closed the fenced-trigger parser failure mode, but the live red metric shows a broader routing gap still exists. This recurrence is not the old fabricated/phantom-data class from KE-805:

- the live metric implementation already contains the clean-start exclusion and the interrupted/null-error exclusion;
- `evaluator.aftermath-coverage-rate-3h` is degraded but not red (`0.6471`), so evaluator liveness is partial rather than globally dead;
- two recent failed sessions already have evaluations, but with non-qualifying verdicts (`good` and `acceptable`), while three older failed sessions still have no evaluation at all.

The current red metric is now narrowed to two concrete live mechanisms:
1. **fallback backfill starvation / partial miss** — `session-aftermath-scan` is configured with `limit: 1`, `maxConcurrent: 2`, but canonical `workflow_runs` currently shows `3` `evaluator-aftermath` runs stuck in `status='running'`, which means the 7-minute fallback commonly self-skips and, even when healthy, can only backfill one missed session per tick. The three still-missing sessions remain visible to the scan predicate (`e.sessionId IS NULL`) in the live 3h window.
2. **status contamination inside evaluator verdict storage** — the two “evaluated but non-qualifying” failed sessions (`s_1781447340225_1`, `s_1781447340275_2`) have `sessions.status='error'`, but their stored `evaluations.overall.status` is `"done"`, allowing one to persist as `good` and the other as `acceptable`. That makes `session.failed-triage-rate-3h` treat them as untriaged even though the aftermath workflow touched them.

This now points away from metric calibration and toward two runtime/product decisions: fix the fallback backlog / running-run leak, and decide whether any `sessions.status='error'` session must be forced to a qualifying triage verdict regardless of transcript/output signals.

## Plan

1. Recompute the live red metric on each owner loop and track the exact unresolved failed sessions until the current alert resolves or worsens.
2. Separate the two failure classes:
   - missing evaluator aftermath (`no evaluation row / no evaluation.routed`)
   - non-qualifying aftermath (`evaluation exists but verdict not in ('needs_improvement','skipped')`).
3. For each class, trace the runtime path and identify whether the correct next action is:
   - runtime dispatch fix,
   - metric calibration,
   - evaluator policy change, or
   - escalation to May/human.
4. Keep May informed with exact session ids and current ratios whenever the metric is live-red.

## Tasks

- id: verify-current-failure-classes
  status: done
  result: succeeded
  assignee: evaluator
  goal: Recompute the live 3h failed-session metric from canonical tables and split the current red window into missing-aftermath vs non-qualifying-verdict cases so the next slice targets the real mechanisms.
  depends_on: []
  attempts: 1

- id: trace-non-qualifying-error-verdicts
  status: done
  result: succeeded
  assignee: evaluator
  goal: Trace why failed sessions `s_1781447340275_2` and `s_1781447340225_1` were routed and evaluated yet landed as `good` / `acceptable`, then determine whether the fix surface is evaluator policy or metric calibration.
  depends_on: [verify-current-failure-classes]
  attempts: 1

- id: trace-missing-failed-aftermath-routing
  status: done
  result: succeeded
  assignee: evaluator
  goal: Trace why failed sessions `s_1781443126387_47`, `s_problem_aks-rp-e2e_task-problem_remaining-execute-paths-batch`, and `s_task_remaining-execute-paths-batch` still stop at `session.completed` plus `session-recovery` `handler.skipped` without any evaluation row, and isolate the current dispatch gate against a recent handled failed control.
  depends_on: [verify-current-failure-classes]
  attempts: 1

- id: package-owner-visible-runtime-brief
  status: done
  result: succeeded
  assignee: evaluator
  goal: Once both failure classes are traced, package the exact session ids, ratios, and recommended action (runtime dispatch fix, evaluator policy change, or metric redefinition) into an owner-visible brief or escalation.
  depends_on: [trace-non-qualifying-error-verdicts, trace-missing-failed-aftermath-routing]
  attempts: 1

## Validation

- `session.failed-triage-rate-3h` returns to `>= 0.8` and stays there across multiple snapshots without relying on the min-sample neutralization.
- Fresh failed sessions consistently show either qualifying aftermath (`needs_improvement`/`skipped`) or an intentionally redefined metric/query with documented rationale.
- Sampled miss lifecycles no longer stop at `session.completed | handler.skipped` when they should enter evaluator aftermath.

## Journal

- 2026-06-14 15:41Z metric-alert-triage: Rechecked the live alert from the canonical metric window and chose **upgrade_or_escalate** again with updated evidence, not calibration or stale resolution. The live metric row is now `current=0.4 < threshold=0.8 < target=1` on open alert `#1798`, with three straight `0.4` snapshots on sample size `5`; a direct recompute against the metric’s own 3h/7m boundaries gives `failed_count=5`, `triaged_count=2`, `ratio=0.4`. The current failed set is now smaller but still real: two sessions remain misclassified by stale pre-error evaluations (`s_1781447340275_2` scout=`good`, `s_1781447340225_1` dev=`acceptable`, both `overall.status='done'` while final `sessions.status='error'`), one failed may session still has no evaluation (`s_1781443126387_47`), and only two sessions qualify (`needs_improvement`). Fresh runtime evidence narrows the remaining missing-routing branch: `workflow_runs` now shows `0` running `evaluator-aftermath` rows, so the active blocker is no longer stuck-running leakage but fallback queue policy. `session-aftermath-scan` still backfills newest terminal sessions first with `limit: 1`; current backlog under that predicate is `41` sessions (`28 done`, `12 interrupted`, `1 error`), and the remaining failed missing session sits at queue position `17`, so the fallback will continue spending ticks on newer non-error backlog before it reaches the session that keeps the metric red. Escalated this refreshed evidence to human because the required fix lives in May/runtime policy: prioritize failed sessions in the fallback queue and/or refresh `good`/`acceptable` evaluations when the final session state flips to `error`.
- 2026-06-14 15:37Z heartbeat escalation: Chose the metric-alert operation **upgrade_or_escalate** rather than calibration. Rechecked the metric row (`owner=evaluator`, `priority=P1`, `current=0.2857`, `threshold=0.8`, `target=1`) and last 10 snapshots (`1.0 -> 0.3333 -> 0.2857`, then flat for five more measurements), confirming the breach is still live and not a stale alert row. Recomputed the exact current 3h denominator and found the same seven failed sessions, with only two qualifying triages. The unresolved set is still split across two real mechanisms: (a) two sessions already have evaluations but with non-qualifying stale pre-error verdicts (`s_1781447340275_2` scout=`good`, `s_1781447340225_1` dev=`acceptable`, both `overall.status='done'` despite final `sessions.status='error'`), and (b) three error sessions still have no evaluation because `session-aftermath-scan` backfills newest terminal sessions first with `limit: 1`, leaving failed sessions at queue positions `17`, `51`, and `52` inside a live backlog of `53` (`37 done`, `13 interrupted`, `3 error`). `workflow_runs` now shows `2` running `evaluator-aftermath` rows rather than `3`, so the main blocker is not only stuck-running leakage; it is also queue policy plus missing refresh-on-terminal-error behavior. Escalated to human for runtime/product decision because this requires owner changes across May runtime and evaluator aftermath policy, not a safe evaluator-lane fix.
- 2026-06-14 15:31Z heartbeat recheck: Revalidated the still-open red alert before choosing a final metric-alert operation. The breach is still real (`session.failed-triage-rate-3h=0.2857`) and stable across the last 8 snapshots (`1.0 -> 0.3333 -> 0.2857`, then flat for four more samples). New evidence narrows the missing-routing branch: `workflow_runs` now shows only **one** live `evaluator-aftermath` run, so the earlier `status='running'` leak is no longer the main blocker. The remaining starvation comes from the fallback queue itself: the canonical `session-aftermath-scan` query backfills **all** terminal sessions with no evaluation, ordered newest-first, with `limit: 1` and no error-first priority. Live backlog is `53` sessions (`37 done`, `13 interrupted`, `3 error`), and the three failed misses sit at queue positions `17`, `51`, and `52`, so the scan will spend many ticks on routine/noisy backlog before reaching the failed sessions that keep the metric red. This strengthens the owner recommendation: runtime should prioritize failed sessions in `session-aftermath-scan` (or raise capacity) and evaluator/runtime should refresh any pre-error `good`/`acceptable` evaluation once the terminal `sessions.status` flips to `error`.
- 2026-06-14 15:22Z trace-missing-failed-aftermath-routing + package-owner-visible-runtime-brief: Finished the missing-routing branch and packaged the owner-visible recommendation. Canonical scan code/config now explains the live misses: `agents/may/handlers/session-aftermath-scan.ts` only backfills `limit: 1` session per 7-minute tick and refuses to run once `workflow_runs` reports `>= maxConcurrent(2)` active `evaluator-aftermath` runs, but canonical DB currently shows `3` such runs still stuck `status='running'`. The three missing failed sessions (`s_1781443126387_47`, `s_problem_aks-rp-e2e_task-problem_remaining-execute-paths-batch`, `s_task_remaining-execute-paths-batch`) still satisfy the scan predicate (`e.sessionId IS NULL`) inside the 3h backfill window, so the fallback path is both undersized and presently self-throttled. Sent May a concrete brief recommending runtime ownership on the stuck-running / backfill-capacity branch plus evaluator/runtime ownership on the stale-success-evaluation branch; explicitly recommended **upgrade/escalate**, not calibration, because the metric is measuring a real open-loop failure.
- 2026-06-14 15:18Z trace-non-qualifying-error-verdicts: Traced the two current non-qualifying failed sessions to evaluator policy rather than metric drift. Canonical `sessions` rows for `s_1781447340225_1` (dev) and `s_1781447340275_2` (scout) both ended `status='error'`, `outcome='error'`, with `meta.json.error='ENOENT: no such file or directory, open'`; yet their existing `evaluations` rows were already written earlier with heuristic verdicts `acceptable` and `good`, because `evaluation.routed` fired off the earlier `session.completed status='done'` event before the runtime later rewrote the same session ids to terminal error. The evaluator workflow's `shouldRefreshEvaluation()` only refreshes stale heuristic versions, so once the early evaluation exists it is not recomputed against the final error state. The metric is therefore doing what it says — counting final failed sessions that never received a qualifying failed-session re-evaluation. Fix surface is evaluator/runtime policy (refresh or defer evaluation on terminal-state changes), not metric calibration: broadening `session.failed-triage-rate-3h` to count `good`/`acceptable` would hide real failed sessions, including scout `good` and dev `acceptable` cases caused by premature success-lane evaluation.
- 2026-06-14 15:12Z owner loop: Rechecked the live breach from canonical DB because the project was `active` with no parser-visible task list. The current red window is now cleanly split across two mechanisms: `s_1781447340275_2` (scout) and `s_1781447340225_1` (dev) both reached `evaluation.routed` and have heuristic evaluations, but landed as non-qualifying verdicts (`good` and `acceptable`); meanwhile `s_1781443126387_47` (may), `s_problem_aks-rp-e2e_task-problem_remaining-execute-paths-batch`, and `s_task_remaining-execute-paths-batch` (aks-explorer) still have no `evaluations` row and their sampled events stop at `session.completed` plus May `session-recovery` `handler.skipped`. Replanned into a new iteration with explicit pending tasks for the verdict-policy branch, the missing-routing branch, and the owner-visible packaging step.
- 2026-06-14 15:07Z heartbeat: Opened after a repeated red alert on `session.failed-triage-rate-3h` (`current=0.2857`, threshold `0.8`, target `1`). Reviewed the metric-alert manual plus prior KEs KE-1740, KE-809, and KE-805. Verified the old clean-start contamination fix is already live in `agents/may/handlers/metrics-snapshot.ts`, so this breach is not a replay of the previously documented phantom-data issue. Canonical recompute of the current metric predicate gives `failed_exact=7`, `triaged_exact=2`; sampled misses `s_1781443126387_47` and `s_task_remaining-execute-paths-batch` still stop at `session.completed | handler.skipped` with no `evaluation.routed`. Opened this follow-on project because the alert now represents durable multi-session routing/policy work rather than a one-session transient judgment.
