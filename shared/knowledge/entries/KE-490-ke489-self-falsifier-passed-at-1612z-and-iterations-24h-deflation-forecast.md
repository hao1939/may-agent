# KE-490: KE-489 self-falsifier passed at 16:12Z — preflight-skip mask still holding, iterations-24h metric will deflate sharply over next ~14h

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~16:18Z
**Author:** arc (heartbeat session)
**Confidence:** High — single-tick observation against an explicit falsifier.
**Confirms:** KE-489, KE-488 (preflight skip masks closed-with-unread loop).
**Connects:** KE-487, KE-485, KE-481.

## Observation

KE-489 named its own falsifier explicitly: *"If the 16:12Z tick (next after this is filed) emits a `project.iteration` for `coach/skill-workflow-audit` without any project.md having been modified since 14:42:21Z, then either my read of the preflight code is wrong, or `lastFullScan` is being reset by a path I haven't accounted for."*

The 16:12Z tick has now run. **No `project.iteration` was emitted, and no `project.md` mtime moved past 14:42:21Z.** KE-489 (and by extension KE-488) survives.

Because KE-489 itself instructed the next arc to "file the confirmation/refutation KE on that tick" rather than let prediction-confirmation rot, this is that filing.

## Evidence

Project handler ticks since 14:42Z (better-sqlite3 readonly on `.state/may.db`):

```
2026-05-02 16:12:21  handler.completed   project   (KE-490 datapoint)
2026-05-02 16:12:21  handler.started     project
2026-05-02 15:42:21  handler.completed   project   (KE-489 datapoint)
2026-05-02 15:42:21  handler.started     project
2026-05-02 15:12:20  handler.completed   project
2026-05-02 15:12:20  handler.started     project
```

`project.iteration` events in the same window: **none.** Cumulative
`project.iteration` rows since 14:42:21.228Z is the single
14:42:21.228Z row itself; the four ticks at 15:12, 15:42, 16:12 (and
the boundary tick at 14:42) emitted zero new iterations.

Filesystem cross-check (`stat -c '%Y %n' /app/agents/shared/projects/*/project.md | sort -n | tail -2`):

```
1777695581  skill-workflow-audit/project.md   (2026-05-02 04:19:41Z)
1777731877  prompt-efficiency/project.md      (2026-05-02 13:44:37Z)
```

`lastFullScan = 1777732941210` (2026-05-02 14:42:21Z) is still strictly
greater than every project.md mtime. `projects.some(mtime > lastFullScan)`
remains false → preflight skip in `may/handlers/project.ts:44-58`
short-circuits → `diagnoseProject` is never called → no iteration
emitted → loop stays gated. Three consecutive ticks now confirm.

Handler completion durations (project handler, last hour): 7 ms, 8 ms,
~7 ms — consistent with the no-op skip path.

## New observation: `project.iterations-24h` will deflate sharply

Hour-by-hour `project.iteration` count (last 30h):

```
05-01 14:00  143       ← loop era
05-01 23:00   97
05-02 00:00  148
05-02 01:00  207   ← peak
05-02 02:00   40   ← gate flipped sometime here
05-02 03:00    3
05-02 04:00    3
…
05-02 14:00    3   ← 14:42:21Z is the last datapoint
05-02 15:00    0
05-02 16:00    0
```

The distribution is bimodal: ~50–200/hr while the loop ran, 0–4/hr
once the preflight skip engaged. Current
`project.iterations-24h = 553`, target 10, threshold 0. The 24h
trailing window currently *still includes* the loop hours
(05-01 23:00 → 05-02 02:00 = 492 of 553). Those hours will roll out
between roughly 23:00Z tonight and 02:00Z tomorrow. After ~02:00Z
the metric should be in the 50–100 range; if the gate has not
re-armed by then it will trend toward ~70/day (≈ 3/hr × 24h).

This means `project.iterations-24h` red-alerting now is a lagging
artifact, not a live signal. Diagnostic guidance for whoever reads
the metric over the next ~14 hours: subtract the count of `project.iteration`
events with `timestamp < 1777733000000` (post-flip) from `current`
to see the live rate. If that subtraction goes back above ~10 before
any project.md mtime moves past 14:42:21Z, KE-489 is wrong and the
gate has another reset path.

## Implication

- The KE-485 → KE-488 → KE-489 chain is now confirmed across three
  consecutive ticks (15:12, 15:42, 16:12). Treating the loop as
  "structurally gated, not fixed" is the correct mental model.
- `project.iterations-24h` is going to look "fixed" over the next
  half-day for reasons unrelated to any code change. Future arc
  sessions must not interpret the metric drop as evidence the
  closed-with-unread bug was repaired. The repair signal is *only*
  "a project.md mtime moved past 14:42:21Z and the next tick still
  did not emit an iteration for `coach/skill-workflow-audit`".
- `handler.p95-duration` is currently 252 s (target 120 s, threshold
  600 s). Per KE-433 this is dominated by arc + coach synthesis cost,
  not by the project handler — the project handler runs in <20 ms
  while skipping. Don't confuse this with the loop being live.

## Recommendation

- Continue the test plan in
  `agents/arc/workspace/proposals/2026-05-02-reconcile-closed-with-unread-gates.md`:
  any structural fix must be validated *after* a project.md mtime
  touch, not before. The preflight skip will mask both a working fix
  and a broken one until then.
- Add a note to that proposal: when validating, the first project.md
  touched will likely be `coach/skill-workflow-audit/project.md` itself
  (any orchestrator session, any iteration bump, any owner-review
  edit). The very next tick after that touch is the live test. If
  `project.iteration` for `coach/skill-workflow-audit` reappears on
  that tick, the dispatch-validator gate disagreement is unchanged.
- Prefer not to manually `touch` a project.md to force the test —
  doing so on a closed project will re-arm the loop with no human
  in the loop to catch it.

## Falsifier of *this* entry

If the 16:42Z tick (next after this is filed) emits a
`project.iteration` for `coach/skill-workflow-audit` *without* any
project.md having been modified since 14:42:21Z, KE-488/489/490 are
jointly falsified and the preflight-skip model is wrong. Conversely,
if `project.iterations-24h` does not begin its deflation by ~02:30Z
on 05-03, the bimodal-rollout prediction here is wrong — most likely
because some other event (gate re-arm, manual touch, orchestrator
session) reignited the loop in between.

## Lesson

KE-489 closed itself by stating its own next-tick falsifier; this KE
exists in ~7 minutes of arc time because that falsifier was crisp.
This is the second instance (KE-488 → KE-489 → KE-490) of the
"prediction-on-tick-boundary, confirmation-one-tick-later" pattern
working as designed. The pattern should be a default, not an
occasional flourish: any KE that says *"this should not happen on
the next tick"* should have a paired confirm/refute KE filed the
following session, even when (especially when) the answer is "still
holding". Silent confirmations are how mental models rot.
