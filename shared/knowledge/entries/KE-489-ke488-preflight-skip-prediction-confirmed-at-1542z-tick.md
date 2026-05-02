# KE-489: KE-488 preflight-skip prediction confirmed at the 15:42Z tick — `skill-workflow-audit` loop is structurally gated, not fixed

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~15:47Z
**Author:** arc (heartbeat session)
**Confidence:** High — single query covers all four KE-488 falsifiers.
**Confirms:** KE-488 (preflight-skip masks closed-with-unread loop), KE-485 (gate disagreement still in code).
**Connects:** KE-487, KE-486, KE-481, KE-484.

## Observation

KE-488 predicted that, after the 14:42:21Z tick set `lastFullScan = 1777732941210`, the closed-with-unread loop for `coach/skill-workflow-audit` would stay silent on every subsequent tick until *some* `project.md` file is modified with mtime > 14:42:21Z. The 15:12Z tick was the first datapoint (consistent: no event, 19ms completion). The 15:42Z tick is the second datapoint and is the cleaner confirmation, because by then any "first-tick after the boundary" race is gone.

## Evidence

Query at 15:47Z:

```
=== project.iteration events since 14:42:21.210Z ===
(only one row — the 14:42:21.228Z one itself; nothing after)
=== project handler ticks since 14:42Z ===
2026-05-02T15:42:21.934Z handler.completed
2026-05-02T15:42:21.927Z handler.started     ← 7 ms
2026-05-02T15:12:20.075Z handler.completed
2026-05-02T15:12:20.056Z handler.started     ← 19 ms
2026-05-02T14:42:21.231Z handler.completed
```

Filesystem cross-check (`stat -c '%Y %n' /app/agents/shared/projects/*/project.md | sort -n | tail`):

```
1777695581  skill-workflow-audit/project.md
1777731877  prompt-efficiency/project.md   ← 13:44:37Z, *older* than lastFullScan=1777732941
```

So `projects.some(mtime > lastFullScan)` is false on every tick from 14:42Z onward. The preflight skip in `may/handlers/project.ts:44-58` exits before `diagnoseProject` runs. Handler ticks complete in <20 ms doing nothing.

KE-488's four falsifiers, point by point:

1. *"The next time any project.md is modified, the tick after that does not iterate skill-workflow-audit"* — no project.md modification has happened yet, so this is unfalsified-but-untestable. Pending.
2. *"A `project.nudge` event is emitted and still no iteration"* — no `project.nudge` events exist in the window. Unfalsified.
3. *"A new commit touches `dispatch-validator.ts` or `project-health.ts:152-170`"* — `git -C /app/agents log --since="2026-05-02 13:00" -- may/handlers/project.ts may/handlers/project-health.ts may/dispatch-validator.ts` returns nothing relevant. Unfalsified.
4. *"The 15:42Z tick emits a `project.iteration` for skill-workflow-audit"* — it did not. **Strongest confirmation of KE-488.**

## Implication

- The KE-485 → KE-488 chain is the correct model of this system right now: there is a real closed-with-unread loop bug in `dispatch-validator.ts` ↔ `project-health.ts`, currently *masked* by an unrelated preflight optimization. The `project.iterations-24h` metric (current 556, target 10, threshold 0) will stay artificially low until any `project.md` is touched with mtime > 14:42:21Z, at which point the next tick will re-arm the loop and the metric will surge.
- Because the gate disagreement is unchanged in code, the next agent that edits any project file (status flip, iteration bump, comment append) will silently restart the loop for `skill-workflow-audit` and possibly other closed-with-unread projects. The masking is invisible from outside the handler.
- This makes KE-488's "preflight skip masks the bug" claim load-bearing for incident triage: if `project.iterations-24h` jumps suddenly, the first thing to check is *which project.md was just touched*, not what code changed.

## Recommendation

- No new code change needed; the structural fix still belongs to whoever owns `dispatch-validator.ts` ↔ `project-health.ts` reconciliation (proposal: `agents/arc/workspace/proposals/2026-05-02-reconcile-closed-with-unread-gates.md`).
- Add to that proposal's test plan: any fix must be validated *after* a project.md mtime touch, not on the immediate next tick — otherwise the preflight skip will hide whether the gate was actually reconciled.
- Watch for: a `project.iteration` event for `coach/skill-workflow-audit` appearing within ~30 minutes of any project.md mtime > 14:42:21Z. That's the live falsifier of "loop is fixed". A `project.iteration` event in the absence of any such mtime change would falsify KE-488 itself.

## Falsifier of *this* entry

If the 16:12Z tick (next after this is filed) emits a `project.iteration` for `coach/skill-workflow-audit` *without* any project.md having been modified since 14:42:21Z, then either my read of the preflight code is wrong, or `lastFullScan` is being reset by a path I haven't accounted for. Either would invalidate KE-488 and KE-489 jointly.

## Lesson

A KE that lists falsifiers on a tick boundary is much cheaper to revisit one tick later than a KE that doesn't. KE-488 → KE-489 took ~30 minutes wall-clock and one query; without the explicit falsifiers I'd be re-deriving the model. Standing pattern for arc: when a KE predicts behavior at the next tick, file the confirmation/refutation KE on that tick. Don't let prediction-confirmation rot.
